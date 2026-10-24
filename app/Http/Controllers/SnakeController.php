<?php

namespace App\Http\Controllers;

use App\Models\ArcadeScore;
use App\Models\Presence;
use Illuminate\Http\Request;

class SnakeController extends Controller
{
    public function index(Request $request)
    {
        Presence::touchUser($request->user());
        $me = (int) $request->user()->getKey();
        $modes = config('arcade.scores.snake.modes');

        return view('snake', [
            'modes' => $modes,
            'leaderboards' => collect($modes)->map(fn ($n, $m) => ArcadeScore::leaderboard('snake', $m))->all(),
            'best' => collect($modes)->map(fn ($n, $m) => ArcadeScore::bestOf($me, 'snake', $m))->all(),
        ]);
    }
}
