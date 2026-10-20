<?php

namespace App\Services;

use App\Models\Game;
use App\Models\GameMove;
use App\Models\Presence;
use App\Models\SiosUser;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class GameEngine
{
    /**
     * Guarda la flota de un jugador; cuando ambas flotas están listas empieza la batalla.
     */
    public function placeShips(Game $game, int $slot, array $ships): void
    {
        if ($game->status !== 'placing') {
            throw ValidationException::withMessages(['ships' => 'La fase de despliegue ya terminó.']);
        }
        if ($game->board($slot)) {
            throw ValidationException::withMessages(['ships' => 'Tu flota ya está desplegada.']);
        }

        $game->{"board$slot"} = Fleet::validate($ships);

        if ($game->board1 && $game->board2) {
            $game->status = 'playing';
            $game->started_at = now();
            // Contra la CPU siempre abre el humano; entre personas, al azar.
            $game->turn = $game->isCpu() ? 1 : random_int(1, 2);
        }
        $game->save();
    }

    /**
     * Dispara a la casilla (x,y) del tablero rival. El juego debe estar bloqueado (lockForUpdate).
     */
    public function fire(Game $game, int $slot, int $x, int $y): GameMove
    {
        $n = Fleet::size();
        if ($game->status !== 'playing') {
            throw ValidationException::withMessages(['shot' => 'La batalla no está en curso.']);
        }
        if ((int) $game->turn !== $slot) {
            throw ValidationException::withMessages(['shot' => 'No es tu turno.']);
        }
        if ($x < 0 || $y < 0 || $x >= $n || $y >= $n) {
            throw ValidationException::withMessages(['shot' => 'Disparo fuera del mapa.']);
        }
        if ($game->moves()->where('player', $slot)->where('x', $x)->where('y', $y)->exists()) {
            throw ValidationException::withMessages(['shot' => 'Ya disparaste a esa casilla.']);
        }

        $enemy = 3 - $slot;
        $board = $game->board($enemy);
        $ship = Fleet::shipAt($board, $x, $y);
        $result = 'miss';

        if ($ship) {
            $result = 'hit';
            $hitKeys = $this->shotsBy($game, $slot)->filter(fn ($m) => $m->result !== 'miss')
                ->map(fn ($m) => "$m->x,$m->y")->push("$x,$y")->flip();
            $sunk = collect(Fleet::cells($ship))->every(fn ($c) => isset($hitKeys["$c[0],$c[1]"]));
            if ($sunk) {
                $result = 'sunk';
            }
        }

        $move = $game->moves()->create([
            'player' => $slot,
            'x' => $x,
            'y' => $y,
            'result' => $result,
            'ship' => $ship['type'] ?? null,
            'created_at' => now(),
        ]);

        $sunkCount = $game->moves()->where('player', $slot)->where('result', 'sunk')->count();
        if ($sunkCount >= count(Fleet::sizes())) {
            $this->finish($game, $slot, 'sunk');
        } else {
            $game->turn = $enemy;
            $game->save();
        }

        return $move;
    }

    /**
     * Turno de la CPU (siempre es el jugador 2).
     */
    public function cpuTurn(Game $game): ?GameMove
    {
        if (! $game->isCpu() || $game->status !== 'playing' || (int) $game->turn !== 2) {
            return null;
        }

        $shots = [];
        $sunkTypes = [];
        foreach ($this->shotsBy($game, 2) as $m) {
            $shots["$m->x,$m->y"] = $m->result;
            if ($m->result === 'sunk') {
                $sunkTypes[] = $m->ship;
            }
        }
        $sunkCells = [];
        $remaining = [];
        foreach ($game->board1 as $ship) {
            if (in_array($ship['type'], $sunkTypes, true)) {
                foreach (Fleet::cells($ship) as [$cx, $cy]) {
                    $sunkCells["$cx,$cy"] = true;
                }
            } else {
                $remaining[] = Fleet::sizes()[$ship['type']];
            }
        }

        [$x, $y] = CpuPlayer::chooseShot($game->difficulty ?? 'normal', $shots, $sunkCells, $remaining);

        return $this->fire($game, 2, $x, $y);
    }

    public function finish(Game $game, int $winner, string $reason): void
    {
        $game->status = 'finished';
        $game->winner = $winner;
        $game->turn = null;
        $game->finish_reason = $reason;
        $game->finished_at = now();
        $game->save();
    }

    /** @return Collection<int,GameMove> */
    private function shotsBy(Game $game, int $slot): Collection
    {
        return $game->moves()->where('player', $slot)->get();
    }

    /**
     * Estado de la partida desde el punto de vista de un jugador.
     * Nunca incluye la posición de barcos rivales que sigan a flote.
     */
    public function stateFor(Game $game, int $slot): array
    {
        $enemy = 3 - $slot;
        $moves = $game->moves()->get();
        $sunkByMe = $moves->where('player', $slot)->where('result', 'sunk')->pluck('ship')->all();
        $sunkByEnemy = $moves->where('player', $enemy)->where('result', 'sunk')->pluck('ship')->all();

        $enemyBoard = $game->board($enemy) ?? [];
        $revealAll = $game->status === 'finished';
        $enemyShips = array_values(array_filter($enemyBoard, fn ($s) => $revealAll || in_array($s['type'], $sunkByMe, true)));

        $opponentId = $game->playerId($enemy);
        $opponentOnline = $game->isCpu() || Presence::isOnline($opponentId);
        $opponentSeen = $game->isCpu() ? null : Presence::find($opponentId)?->last_seen_at;
        $canClaim = ! $game->isCpu() && $game->isActive()
            && (! $opponentSeen || $opponentSeen->lt(now()->subSeconds(config('battleships.abandon_seconds'))));

        return [
            'id' => $game->id,
            'mode' => $game->mode,
            'difficulty' => $game->difficulty,
            'status' => $game->status,
            'me' => $slot,
            'turn' => $game->turn,
            'winner' => $game->winner,
            'finish_reason' => $game->finish_reason,
            'players' => [
                1 => ['name' => $game->player1_name, 'initials' => SiosUser::initialsFor($game->player1_name)],
                2 => ['name' => $game->player2_name, 'initials' => $game->isCpu() ? 'IA' : SiosUser::initialsFor($game->player2_name)],
            ],
            'ready' => [1 => (bool) $game->board1, 2 => (bool) $game->board2],
            'my_ships' => $game->board($slot) ?? [],
            'enemy_ships' => $enemyShips,
            'sunk_by_me' => $sunkByMe,
            'sunk_by_enemy' => $sunkByEnemy,
            'moves' => $moves->map->toClient()->values(),
            'opponent_online' => $opponentOnline,
            'can_claim' => $canClaim,
            'stats' => [
                1 => $this->stats($moves->where('player', 1)),
                2 => $this->stats($moves->where('player', 2)),
            ],
        ];
    }

    private function stats(Collection $moves): array
    {
        $shots = $moves->count();
        $hits = $moves->where('result', '!=', 'miss')->count();

        return ['shots' => $shots, 'hits' => $hits, 'accuracy' => $shots ? (int) round($hits * 100 / $shots) : 0];
    }
}
