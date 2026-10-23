<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class PacmanScore extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    /**
     * Mejor puntaje de cada jugador, de mayor a menor.
     */
    public static function leaderboard(int $limit = 10): array
    {
        $best = static::select('user_id', DB::raw('MAX(score) as best'))->groupBy('user_id');

        return static::query()
            ->joinSub($best, 'b', fn ($j) => $j->on('b.user_id', '=', 'pacman_scores.user_id')->on('b.best', '=', 'pacman_scores.score'))
            ->orderByDesc('score')->orderBy('pacman_scores.id')
            ->get(['pacman_scores.user_id', 'user_name', 'score', 'level', 'pacman_scores.created_at'])
            ->unique('user_id')->take($limit)
            ->map(fn ($s) => [
                'user_id' => (int) $s->user_id,
                'name' => $s->user_name,
                'score' => (int) $s->score,
                'level' => (int) $s->level,
                'date' => $s->created_at?->format('d/m/Y'),
            ])->values()->all();
    }

    public static function bestOf(int $userId): int
    {
        return (int) static::where('user_id', $userId)->max('score');
    }
}
