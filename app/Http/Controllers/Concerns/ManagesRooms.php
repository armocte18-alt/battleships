<?php

namespace App\Http\Controllers\Concerns;

use App\Models\ArcadeRoom;
use App\Models\ChatMessage;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Salas en tiempo real compartidas por los juegos multijugador.
 *
 * Durante la partida los navegadores intercambian su estado a través de
 * /sync: el servidor solo guarda el último paquete de cada jugador en la
 * caché y le devuelve al anfitrión los de los invitados, y a los invitados
 * el del anfitrión. No interpreta el contenido.
 */
trait ManagesRooms
{
    /** Clave del juego ('asteroids', 'pong'). */
    abstract protected function roomGame(): string;

    abstract protected function maxPlayers(): int;

    /** @return string[] color de cada lugar */
    abstract protected function roomColors(): array;

    /** Texto del aviso en el chat general al abrir una sala. */
    abstract protected function roomAnnouncement(ArcadeRoom $room): string;

    public function rooms(Request $request)
    {
        $me = (int) $request->user()->getKey();
        Presence::touchUser($request->user());
        $idle = now()->subSeconds(config('arcade.rooms.idle_seconds'));
        $base = fn () => ArcadeRoom::where('game', $this->roomGame())->where('updated_at', '>=', $idle);

        $rooms = $base()->where('status', 'waiting')->latest()->take(20)->get();
        $mine = $rooms->first(fn ($r) => $r->slotOf($me) !== null)
            ?? $base()->where('status', 'playing')->get()->first(fn ($r) => $r->slotOf($me) !== null);

        return response()->json([
            'rooms' => $rooms->map->toClient()->values(),
            'mine' => $mine?->toClient(),
        ]);
    }

    public function create(Request $request)
    {
        $user = $request->user();
        $this->leaveAll((int) $user->getKey());

        $room = ArcadeRoom::create([
            'game' => $this->roomGame(),
            'host_id' => $user->getKey(),
            'status' => 'waiting',
            'players' => [$this->roomPlayer($user, 0)],
            'seed' => random_int(1, 2_000_000_000),
        ]);

        ChatMessage::create([
            'game_id' => null,
            'user_id' => $user->getKey(),
            'user_name' => $user->name,
            'body' => $this->roomAnnouncement($room),
            'created_at' => now(),
        ]);

        return response()->json($room->toClient());
    }

    public function join(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        $user = $request->user();
        $me = (int) $user->getKey();

        $result = DB::transaction(function () use ($room, $user, $me) {
            $room = ArcadeRoom::lockForUpdate()->findOrFail($room->id);
            if ($room->slotOf($me) !== null) {
                return $room;
            }
            if ($room->status !== 'waiting') {
                throw ValidationException::withMessages(['room' => 'La partida ya comenzó.']);
            }
            $used = array_column($room->players, 'slot');
            $free = array_values(array_diff(range(0, $this->maxPlayers() - 1), $used));
            if (! $free) {
                throw ValidationException::withMessages(['room' => 'La sala está llena.']);
            }
            $room->players = [...$room->players, $this->roomPlayer($user, $free[0])];
            $room->save();

            return $room;
        });

        $this->leaveAll($me, except: $result->id);

        return response()->json($result->toClient());
    }

    public function leave(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        $this->leaveRoom($room, (int) $request->user()->getKey());

        return response()->json(['ok' => true]);
    }

    public function show(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        $me = (int) $request->user()->getKey();
        abort_if($room->slotOf($me) === null, 403, 'No estás en esta sala.');
        if ((int) $room->host_id === $me && $room->updated_at->lt(now()->subSeconds(10))) {
            $room->touch(); // mantiene la sala visible en el listado
        }

        return response()->json($room->toClient());
    }

    public function start(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        abort_unless((int) $room->host_id === (int) $request->user()->getKey(), 403);
        if ($room->status === 'waiting') {
            $room->update(['status' => 'playing']);
        }

        return response()->json($room->toClient());
    }

    public function finish(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        abort_unless((int) $room->host_id === (int) $request->user()->getKey(), 403);
        $room->update(['status' => 'finished']);

        return response()->json(['ok' => true]);
    }

    public function sync(Request $request, ArcadeRoom $room)
    {
        $this->ensureGame($room);
        $slot = $room->slotOf((int) $request->user()->getKey());
        abort_if($slot === null, 403);

        $raw = $request->getContent();
        if (strlen($raw) > 60000 || ! json_validate($raw)) {
            abort(422, 'Paquete inválido.');
        }

        $now = microtime(true);
        Cache::put("room:{$room->id}:$slot", ['t' => $now, 'd' => $raw], 30);
        if ($slot === 0 && $room->updated_at->lt(now()->subSeconds(10))) {
            $room->touch();
        }

        // El anfitrión recibe a los invitados; los invitados reciben al anfitrión.
        $wanted = $slot === 0 ? array_diff(array_column($room->players, 'slot'), [0]) : [0];
        $parts = [];
        foreach ($wanted as $s) {
            $entry = Cache::get("room:{$room->id}:$s");
            if ($entry) {
                $parts[] = '"'.$s.'":{"age":'.round($now - $entry['t'], 3).',"d":'.$entry['d'].'}';
            }
        }

        return response('{"status":"'.$room->status.'","peers":{'.implode(',', $parts).'}}', 200, ['Content-Type' => 'application/json']);
    }

    protected function ensureGame(ArcadeRoom $room): void
    {
        abort_unless($room->game === $this->roomGame(), 404);
    }

    private function roomPlayer($user, int $slot): array
    {
        return ['id' => (int) $user->getKey(), 'name' => $user->name, 'slot' => $slot, 'color' => $this->roomColors()[$slot]];
    }

    /** Sale de las salas en espera de cualquier juego (solo se juega una a la vez). */
    private function leaveAll(int $userId, ?int $except = null): void
    {
        ArcadeRoom::where('status', 'waiting')->when($except, fn ($q) => $q->where('id', '!=', $except))->get()
            ->filter(fn ($r) => $r->slotOf($userId) !== null)
            ->each(fn ($r) => $this->leaveRoom($r, $userId));
    }

    private function leaveRoom(ArcadeRoom $room, int $userId): void
    {
        DB::transaction(function () use ($room, $userId) {
            $room = ArcadeRoom::lockForUpdate()->find($room->id);
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
