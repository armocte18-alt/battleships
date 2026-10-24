<?php

namespace App\Http\Controllers;

use App\Models\ArcadeScore;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Guarda puntajes de los juegos registrados en config('arcade.scores').
 */
class ArcadeScoreController extends Controller
{
    public function store(Request $request, string $game)
    {
        $cfg = config("arcade.scores.$game");
        abort_unless($cfg, 404);

        $data = $request->validate([
            'mode' => ['required', Rule::in(array_keys($cfg['modes']))],
            'score' => ['required', 'integer', 'min:0', 'max:'.$cfg['max']],
            'duration' => ['required', 'integer', 'min:1', 'max:86400'],
            'meta' => ['nullable', 'array'],
            'meta.*' => ['nullable', 'integer', 'min:0', 'max:100000'],
        ]);

        if ($data['score'] > $data['duration'] * $cfg['max_per_second'] + 500) {
            throw ValidationException::withMessages(['score' => 'Puntaje no válido.']);
        }

        $user = $request->user();
        $me = (int) $user->getKey();
        $key = "arcade:$game:$me";
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['score' => 'Demasiados envíos, espera un momento.']);
        }
        RateLimiter::hit($key, 60);

        $previous = ArcadeScore::bestOf($me, $game, $data['mode']);
        ArcadeScore::create([
            'game' => $game,
            'mode' => $data['mode'],
            'user_id' => $me,
            'user_name' => $user->name,
            'score' => $data['score'],
            'duration' => $data['duration'],
            'meta' => array_slice($data['meta'] ?? [], 0, 8, true),
            'created_at' => now(),
        ]);

        return response()->json([
            'best' => max($previous, $data['score']),
            'new_best' => $data['score'] > $previous,
            'rank' => ArcadeScore::where('game', $game)->where('mode', $data['mode'])
                ->where('score', '>', $data['score'])->where('user_id', '!=', $me)
                ->distinct()->count('user_id') + 1,
            'leaderboard' => ArcadeScore::leaderboard($game, $data['mode']),
        ]);
    }
}
