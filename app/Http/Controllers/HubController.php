<?php

namespace App\Http\Controllers;

use App\Models\ArcadeScore;
use App\Models\Game;
use App\Models\MinesweeperScore;
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
            'minesweeper' => [
                ['label' => 'Victorias', 'value' => MinesweeperScore::where('user_id', $me)->count()],
                ['label' => 'Tu mejor · Intermedio', 'value' => $this->seconds(MinesweeperScore::bestOf($me, 'medium'))],
            ],
        ];

        foreach (['asteroids', 'snake'] as $game) {
            $top = collect(array_keys(config("arcade.scores.$game.modes")))
                ->map(fn ($m) => ArcadeScore::leaderboard($game, $m, 1)[0] ?? null)->filter()->sortByDesc('score')->first();
            $stats[$game] = [
                ['label' => 'Tu mejor', 'value' => number_format(ArcadeScore::bestOf($me, $game))],
                ['label' => 'Récord', 'value' => $top ? number_format($top['score']) : '—', 'hint' => $top['name'] ?? null],
            ];
        }

        $pong = collect(PongController::leaderboard(null));
        $mine = $pong->firstWhere('user_id', $me);
        $stats['pong'] = [
            ['label' => 'Victorias', 'value' => $mine['wins'] ?? 0],
            ['label' => 'Campeón', 'value' => $pong->first()['name'] ?? '—'],
        ];

        return view('hub', [
            'games' => config('arcade.games'),
            'stats' => $stats,
            'user' => $request->user(),
        ]);
    }

    private function seconds(?int $ms): string
    {
        return $ms === null ? '—' : number_format($ms / 1000, 1).' s';
    }
}
