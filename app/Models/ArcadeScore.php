<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ArcadeScore extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    protected $casts = ['meta' => 'array'];

    /**
     * Mejor puntaje de cada jugador en un juego y modo, de mayor a menor.
     */
    public static function leaderboard(string $game, string $mode, int $limit = 10): array
    {
        $best = static::select('user_id', DB::raw('MAX(score) as best'))
            ->where('game', $game)->where('mode', $mode)->groupBy('user_id');

        return static::query()
            ->joinSub($best, 'b', fn ($j) => $j->on('b.user_id', '=', 'arcade_scores.user_id')->on('b.best', '=', 'arcade_scores.score'))
            ->where('game', $game)->where('mode', $mode)
            ->orderByDesc('score')->orderBy('arcade_scores.id')
            ->get(['arcade_scores.user_id', 'user_name', 'score', 'meta', 'arcade_scores.created_at'])
            ->unique('user_id')->take($limit)
            ->map(fn ($s) => [
                'user_id' => (int) $s->user_id,
                'name' => $s->user_name,
                'score' => (int) $s->score,
                'meta' => $s->meta ?? [],
                'date' => $s->created_at?->format('d/m/Y'),
            ])->values()->all();
    }

    public static function bestOf(int $userId, string $game, ?string $mode = null): int
    {
        return (int) static::where('user_id', $userId)->where('game', $game)
            ->when($mode, fn ($q) => $q->where('mode', $mode))->max('score');
    }
}
