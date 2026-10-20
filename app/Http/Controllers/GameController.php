<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\Game;
use App\Models\Presence;
use App\Models\SiosUser;
use App\Services\Fleet;
use App\Services\GameEngine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class GameController extends Controller
{
    public function __construct(private GameEngine $engine) {}

    public function show(Request $request, Game $game)
    {
        $this->slot($request, $game);

        return view('game', ['game' => $game, 'user' => $request->user()]);
    }

    public function state(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        Presence::touchUser($request->user(), $game->isActive() || $game->status === 'invited' ? $game->id : null);

        return response()->json($this->payload($request, $game->fresh(), $slot));
    }

    public function createCpu(Request $request)
    {
        $data = $request->validate([
            'difficulty' => ['required', Rule::in(array_keys(config('battleships.difficulties')))],
        ]);

        $game = Game::create([
            'mode' => 'cpu',
            'status' => 'placing',
            'difficulty' => $data['difficulty'],
            'player1_id' => $request->user()->getKey(),
            'player1_name' => $request->user()->name,
            'player2_id' => Game::CPU_ID,
            'player2_name' => 'Almirante IA · '.config('battleships.difficulties')[$data['difficulty']],
            'board2' => Fleet::random(),
        ]);

        return $this->respond($request, $game);
    }

    public function invite(Request $request)
    {
        $me = $request->user();
        $data = $request->validate(['user_id' => ['required', 'integer']]);
        $rival = SiosUser::find($data['user_id']);

        if (! $rival || (int) $rival->getKey() === (int) $me->getKey()) {
            throw ValidationException::withMessages(['user_id' => 'Jugador no válido.']);
        }

        // Si el rival ya me había invitado, acepto directamente esa invitación.
        $pending = Game::where('status', 'invited')->where('player1_id', $rival->getKey())
            ->where('player2_id', $me->getKey())
            ->where('created_at', '>=', now()->subSeconds(config('battleships.invite_seconds')))->first();
        if ($pending) {
            $pending->update(['status' => 'placing']);

            return $this->respond($request, $pending);
        }

        // Una sola invitación abierta a la vez.
        Game::where('status', 'invited')->where('player1_id', $me->getKey())->update(['status' => 'cancelled']);

        $game = Game::create([
            'mode' => 'pvp',
            'status' => 'invited',
            'player1_id' => $me->getKey(),
            'player1_name' => $me->name,
            'player2_id' => $rival->getKey(),
            'player2_name' => $rival->name,
        ]);

        return $this->respond($request, $game);
    }

    public function accept(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        $expired = $game->created_at->lt(now()->subSeconds(config('battleships.invite_seconds')));
        if ($slot !== 2 || $game->status !== 'invited' || $expired) {
            throw ValidationException::withMessages(['game' => 'La invitación ya no está disponible.']);
        }
        $game->update(['status' => 'placing']);

        return $this->respond($request, $game);
    }

    public function decline(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        if ($game->status === 'invited') {
            $game->update(['status' => $slot === 2 ? 'declined' : 'cancelled']);
        }

        return $this->respond($request, $game, route('lobby'));
    }

    public function ships(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        DB::transaction(function () use ($game, $slot, $request) {
            $locked = Game::lockForUpdate()->findOrFail($game->id);
            $this->engine->placeShips($locked, $slot, $request->input('ships', []));
        });

        return response()->json($this->payload($request, $game->fresh(), $slot));
    }

    public function fire(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        $data = $request->validate([
            'x' => ['required', 'integer'],
            'y' => ['required', 'integer'],
        ]);

        DB::transaction(function () use ($game, $slot, $data) {
            $locked = Game::lockForUpdate()->findOrFail($game->id);
            $move = $this->engine->fire($locked, $slot, (int) $data['x'], (int) $data['y']);

            if ($locked->isCpu()) {
                $this->cpuTaunt($locked, $move->result, true);
                if ($cpuMove = $this->engine->cpuTurn($locked)) {
                    $this->cpuTaunt($locked, $cpuMove->result, false);
                }
            }
        });

        return response()->json($this->payload($request, $game->fresh(), $slot));
    }

    public function forfeit(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        if ($game->isActive()) {
            $this->engine->finish($game, 3 - $slot, 'forfeit');
        }

        return response()->json($this->payload($request, $game->fresh(), $slot));
    }

    /**
     * Si el rival lleva tiempo desconectado, se puede reclamar la victoria.
     */
    public function claim(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        if (! $this->engine->stateFor($game, $slot)['can_claim']) {
            throw ValidationException::withMessages(['game' => 'Tu rival sigue conectado.']);
        }
        $this->engine->finish($game, $slot, 'abandon');

        return response()->json($this->payload($request, $game->fresh(), $slot));
    }

    public function rematch(Request $request, Game $game)
    {
        $slot = $this->slot($request, $game);
        if ($game->status !== 'finished') {
            throw ValidationException::withMessages(['game' => 'La partida aún no termina.']);
        }

        if ($game->isCpu()) {
            $request->merge(['difficulty' => $game->difficulty]);

            return $this->createCpu($request);
        }

        $request->merge(['user_id' => $game->playerId(3 - $slot)]);

        return $this->invite($request);
    }

    private function payload(Request $request, Game $game, int $slot): array
    {
        $state = $game->status === 'invited'
            ? ['id' => $game->id, 'status' => 'invited', 'me' => $slot, 'mode' => $game->mode,
                'players' => [1 => ['name' => $game->player1_name], 2 => ['name' => $game->player2_name]],
                'expires_in' => max(0, config('battleships.invite_seconds') - $game->created_at->diffInSeconds(now()))]
            : $this->engine->stateFor($game, $slot);

        // ¿El rival propone revancha?
        if ($game->status === 'finished' && ! $game->isCpu()) {
            $rematch = Game::where('status', 'invited')->where('player2_id', $game->playerId($slot))
                ->where('player1_id', $game->playerId(3 - $slot))->where('created_at', '>=', $game->finished_at)
                ->latest()->first();
            $state['rematch_url'] = $rematch ? route('games.show', $rematch) : null;
        }

        $state['chat'] = ChatMessage::where('game_id', $game->id)
            ->where('id', '>', (int) $request->input('chat_after', 0))
            ->orderBy('id')->take(100)->get()->map->toClient()->values();

        return $state;
    }

    private function respond(Request $request, Game $game, ?string $url = null)
    {
        $url ??= route('games.show', $game);

        return $request->expectsJson() ? response()->json(['url' => $url, 'id' => $game->id]) : redirect($url);
    }

    private function slot(Request $request, Game $game): int
    {
        $slot = $game->slotOf((int) $request->user()->getKey());
        abort_if($slot === null, 403, 'No participas en esta partida.');

        return $slot;
    }

    private function cpuTaunt(Game $game, string $result, bool $playerShot): void
    {
        $lines = $playerShot
            ? ['sunk' => ['¡Nooo! Hundiste mi barco… esto no se queda así.', '¡Glup glup! Ese barco era mi favorito.', 'Buen tiro, marinero. Disfrútalo mientras dure.']]
            : [
                'sunk' => ['¡Hundido! A pique, como tus esperanzas. 😎', '¡Otro barco al fondo del mar!', 'Mis cálculos eran correctos. ¡Hundido!'],
                'hit' => ['¡Impacto directo! 💥', '¡Te encontré!', 'Huelo pólvora… y es la tuya.'],
            ];
        $options = $lines[$result] ?? null;
        if (! $options || random_int(1, 100) > ($result === 'sunk' ? 85 : 30)) {
            return;
        }

        ChatMessage::create([
            'game_id' => $game->id,
            'user_id' => Game::CPU_ID,
            'user_name' => $game->player2_name,
            'body' => $options[array_rand($options)],
            'created_at' => now(),
        ]);
    }
}
