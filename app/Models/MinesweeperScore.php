<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class MinesweeperScore extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    /**
     * Mejor tiempo de cada jugador en una dificultad, del más rápido al más lento.
     */
    public static function leaderboard(string $difficulty, int $limit = 10): array
    {
        $best = static::select('user_id', DB::raw('MIN(time_ms) as best'))
            ->where('difficulty', $difficulty)->groupBy('user_id');

        return static::query()
            ->joinSub($best, 'b', fn ($j) => $j->on('b.user_id', '=', 'minesweeper_scores.user_id')->on('b.best', '=', 'minesweeper_scores.time_ms'))
            ->where('difficulty', $difficulty)
            ->orderBy('time_ms')->orderBy('minesweeper_scores.id')
            ->get(['minesweeper_scores.user_id', 'user_name', 'time_ms', 'minesweeper_scores.created_at'])
            ->unique('user_id')->take($limit)
            ->map(fn ($s) => [
                'user_id' => (int) $s->user_id,
                'name' => $s->user_name,
                'time_ms' => (int) $s->time_ms,
                'date' => $s->created_at?->format('d/m/Y'),
            ])->values()->all();
    }

    public static function bestOf(int $userId, string $difficulty): ?int
    {
        $best = static::where('user_id', $userId)->where('difficulty', $difficulty)->min('time_ms');

        return $best === null ? null : (int) $best;
    }
}
