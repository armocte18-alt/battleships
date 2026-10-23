<?php

namespace App\Http\Controllers;

use App\Models\PacmanScore;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class PacmanController extends Controller
{
    public function index(Request $request)
    {
        Presence::touchUser($request->user());

        return view('pacman', [
            'leaderboard' => PacmanScore::leaderboard(),
            'best' => PacmanScore::bestOf((int) $request->user()->getKey()),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $data = $request->validate([
            'score' => ['required', 'integer', 'min:0', 'max:9999990'],
            'level' => ['required', 'integer', 'min:1', 'max:255'],
            'duration' => ['required', 'integer', 'min:1', 'max:86400'],
        ]);

        $cfg = config('arcade.pacman');
        $plausible = $data['score'] <= $data['level'] * $cfg['max_score_per_level']
            && $data['duration'] >= ($data['level'] - 1) * $cfg['min_seconds_per_level'];
        if (! $plausible) {
            throw ValidationException::withMessages(['score' => 'Puntaje no válido.']);
        }

        $key = 'pacman:'.$user->getKey();
        if (RateLimiter::tooManyAttempts($key, 6)) {
            throw ValidationException::withMessages(['score' => 'Demasiados envíos, espera un momento.']);
        }
        RateLimiter::hit($key, 60);

        $previous = PacmanScore::bestOf((int) $user->getKey());
        PacmanScore::create($data + ['user_id' => $user->getKey(), 'user_name' => $user->name, 'created_at' => now()]);

        $leaderboard = PacmanScore::leaderboard();

        return response()->json([
            'best' => max($previous, $data['score']),
            'new_best' => $data['score'] > $previous,
            'rank' => PacmanScore::where('score', '>', $data['score'])->distinct()->count('user_id') + 1,
            'leaderboard' => $leaderboard,
        ]);
    }
}
