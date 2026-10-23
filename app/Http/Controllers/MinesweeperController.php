<?php

namespace App\Http\Controllers;

use App\Models\MinesweeperScore;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class MinesweeperController extends Controller
{
    public function index(Request $request)
    {
        Presence::touchUser($request->user());
        $me = (int) $request->user()->getKey();
        $levels = config('arcade.minesweeper.levels');

        return view('minesweeper', [
            'levels' => $levels,
            'leaderboards' => collect($levels)->map(fn ($l, $key) => MinesweeperScore::leaderboard($key))->all(),
            'best' => collect($levels)->map(fn ($l, $key) => MinesweeperScore::bestOf($me, $key))->all(),
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $levels = config('arcade.minesweeper.levels');
        $data = $request->validate([
            'difficulty' => ['required', Rule::in(array_keys($levels))],
            'time_ms' => ['required', 'integer', 'max:86400000'],
        ]);

        if ($data['time_ms'] < $levels[$data['difficulty']]['min_ms']) {
            throw ValidationException::withMessages(['time_ms' => 'Tiempo no válido.']);
        }

        $key = 'minesweeper:'.$user->getKey();
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['time_ms' => 'Demasiados envíos, espera un momento.']);
        }
        RateLimiter::hit($key, 60);

        $me = (int) $user->getKey();
        $previous = MinesweeperScore::bestOf($me, $data['difficulty']);
        MinesweeperScore::create($data + ['user_id' => $me, 'user_name' => $user->name, 'created_at' => now()]);

        return response()->json([
            'best' => $previous === null ? $data['time_ms'] : min($previous, $data['time_ms']),
            'new_best' => $previous === null || $data['time_ms'] < $previous,
            'rank' => MinesweeperScore::where('difficulty', $data['difficulty'])
                ->where('time_ms', '<', $data['time_ms'])->where('user_id', '!=', $me)
                ->distinct()->count('user_id') + 1,
            'leaderboard' => MinesweeperScore::leaderboard($data['difficulty']),
        ]);
    }
}
