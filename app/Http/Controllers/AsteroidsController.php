<?php

namespace App\Http\Controllers;

use App\Models\ArcadeScore;
use App\Models\AsteroidRoom;
use App\Models\ChatMessage;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Asteroides: modo solo y salas cooperativas de hasta 3 jugadores.
 *
 * Durante la partida el navegador del anfitrión simula el mundo (asteroides,
 * colisiones, puntos) y cada jugador controla su propia nave. Todos envían su
 * estado a /sync unas 10 veces por segundo; el servidor solo lo retransmite
 * a través de la caché, sin procesarlo.
 */
class AsteroidsController extends Controller
{
    private const COLORS = ['#3ff2ff', '#ff3399', '#ffc23d'];

    public function index(Request $request)
    {
        Presence::touchUser($request->user());

        return view('asteroids', [
            'leaderboard' => ArcadeScore::leaderboard('asteroids', 'classic'),
            'best' => ArcadeScore::bestOf((int) $request->user()->getKey(), 'asteroids'),
            'colors' => self::COLORS,
        ]);
    }

    public function rooms(Request $request)
    {
        $me = (int) $request->user()->getKey();
        Presence::touchUser($request->user());
        $idle = now()->subSeconds(config('arcade.asteroids.room_idle_seconds'));

        $rooms = AsteroidRoom::where('status', 'waiting')->where('updated_at', '>=', $idle)->latest()->take(20)->get();
        $mine = $rooms->first(fn ($r) => $r->slotOf($me) !== null)
            ?? AsteroidRoom::where('status', 'playing')->where('updated_at', '>=', $idle)->get()->first(fn ($r) => $r->slotOf($me) !== null);

        return response()->json([
            'rooms' => $rooms->map->toClient()->values(),
            'mine' => $mine?->toClient(),
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        $this->leaveAll((int) $user->getKey());

        $room = AsteroidRoom::create([
            'host_id' => $user->getKey(),
            'status' => 'waiting',
            'players' => [$this->player($user, 0)],
            'seed' => random_int(1, 2_000_000_000),
        ]);

        ChatMessage::create([
            'game_id' => null,
            'user_id' => $user->getKey(),
            'user_name' => $user->name,
            'body' => "🚀 Abrí la sala de Asteroides #{$room->id}. ¡Únete desde la Sala de juegos → Asteroides! (hasta 3 jugadores)",
            'created_at' => now(),
        ]);

        return response()->json($room->toClient());
    }

    public function join(Request $request, AsteroidRoom $room)
    {
        $user = $request->user();
        $me = (int) $user->getKey();

        $result = DB::transaction(function () use ($room, $user, $me) {
            $room = AsteroidRoom::lockForUpdate()->findOrFail($room->id);
            if ($room->slotOf($me) !== null) {
                return $room;
            }
            if ($room->status !== 'waiting') {
                throw ValidationException::withMessages(['room' => 'La partida ya comenzó.']);
            }
            $used = array_column($room->players, 'slot');
            $free = array_values(array_diff(range(0, config('arcade.asteroids.max_players') - 1), $used));
            if (! $free) {
                throw ValidationException::withMessages(['room' => 'La sala está llena.']);
            }
            $room->players = [...$room->players, $this->player($user, $free[0])];
            $room->save();

            return $room;
        });

        $this->leaveAll($me, except: $result->id);

        return response()->json($result->toClient());
    }

    public function leave(Request $request, AsteroidRoom $room)
    {
        $this->leaveRoom($room, (int) $request->user()->getKey());

        return response()->json(['ok' => true]);
    }

    public function show(Request $request, AsteroidRoom $room)
    {
        $me = (int) $request->user()->getKey();
        abort_if($room->slotOf($me) === null, 403, 'No estás en esta sala.');
        if ((int) $room->host_id === $me && $room->updated_at->lt(now()->subSeconds(10))) {
            $room->touch(); // mantiene la sala visible en el listado
        }

        return response()->json($room->toClient());
    }

    public function start(Request $request, AsteroidRoom $room)
    {
        abort_unless((int) $room->host_id === (int) $request->user()->getKey(), 403);
        if ($room->status === 'waiting') {
            $room->update(['status' => 'playing']);
        }

        return response()->json($room->toClient());
    }

    public function finish(Request $request, AsteroidRoom $room)
    {
        abort_unless((int) $room->host_id === (int) $request->user()->getKey(), 403);
        $room->update(['status' => 'finished']);

        return response()->json(['ok' => true]);
    }

    /**
     * Relevo de estado en tiempo real. El cuerpo es JSON opaco que solo
     * interpretan los navegadores; se guarda tal cual en la caché.
     */
    public function sync(Request $request, AsteroidRoom $room)
    {
        $slot = $room->slotOf((int) $request->user()->getKey());
        abort_if($slot === null, 403);

        $raw = $request->getContent();
        if (strlen($raw) > 60000 || ! json_validate($raw)) {
            abort(422, 'Paquete inválido.');
        }

        $now = microtime(true);
        Cache::put("ast:{$room->id}:$slot", ['t' => $now, 'd' => $raw], 30);
        if ($slot === 0 && $room->updated_at->lt(now()->subSeconds(10))) {
            $room->touch();
        }

        // El anfitrión recibe a los invitados; los invitados reciben al anfitrión.
        $wanted = $slot === 0 ? array_diff(array_column($room->players, 'slot'), [0]) : [0];
        $parts = [];
        foreach ($wanted as $s) {
            $entry = Cache::get("ast:{$room->id}:$s");
            if ($entry) {
                $parts[] = '"'.$s.'":{"age":'.round($now - $entry['t'], 3).',"d":'.$entry['d'].'}';
            }
        }

        return response('{"status":"'.$room->status.'","peers":{'.implode(',', $parts).'}}', 200, ['Content-Type' => 'application/json']);
    }

    private function player($user, int $slot): array
    {
        return ['id' => (int) $user->getKey(), 'name' => $user->name, 'slot' => $slot, 'color' => self::COLORS[$slot]];
    }

    private function leaveAll(int $userId, ?int $except = null): void
    {
        AsteroidRoom::where('status', 'waiting')->when($except, fn ($q) => $q->where('id', '!=', $except))->get()
            ->filter(fn ($r) => $r->slotOf($userId) !== null)
            ->each(fn ($r) => $this->leaveRoom($r, $userId));
    }

    private function leaveRoom(AsteroidRoom $room, int $userId): void
    {
        DB::transaction(function () use ($room, $userId) {
            $room = AsteroidRoom::lockForUpdate()->find($room->id);
            if (! $room || $room->slotOf($userId) === null) {
                return;
            }
            if ((int) $room->host_id === $userId && $room->status === 'waiting') {
                $room->status = 'finished'; // el anfitrión cerró la sala
            }
            if ($room->status === 'waiting') {
                $room->players = array_values(array_filter($room->players, fn ($p) => (int) $p['id'] !== $userId));
            }
            $room->save();
        });
    }
}
