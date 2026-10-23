<?php

namespace App\Http\Controllers;

use App\Models\Game;
use App\Models\PacmanScore;
use App\Models\Presence;
use Illuminate\Http\Request;

class HubController extends Controller
{
    public function index(Request $request)
    {
        $me = (int) $request->user()->getKey();
        Presence::touchUser($request->user());

        $finished = Game::involving($me)->where('status', 'finished')->get();
        $wins = $finished->filter(fn (Game $g) => $g->winner === $g->slotOf($me))->count();
        $record = PacmanScore::leaderboard(1)[0] ?? null;

        $stats = [
            'battleships' => [
                ['label' => 'Victorias', 'value' => $wins],
                ['label' => 'Batallas', 'value' => $finished->count()],
            ],
            'pacman' => [
                ['label' => 'Tu mejor', 'value' => number_format(PacmanScore::bestOf($me))],
                ['label' => 'Récord', 'value' => $record ? number_format($record['score']) : '—', 'hint' => $record['name'] ?? null],
            ],
        ];

        return view('hub', [
            'games' => config('arcade.games'),
            'stats' => $stats,
            'user' => $request->user(),
        ]);
    }
}
