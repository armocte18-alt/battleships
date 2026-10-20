<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\Game;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

class LobbyController extends Controller
{
    public function index(Request $request)
    {
        return view('lobby', ['user' => $request->user()]);
    }

    public function poll(Request $request)
    {
        $user = $request->user();
        $me = (int) $user->getKey();
        Presence::touchUser($user);

        $inviteSince = now()->subSeconds(config('battleships.invite_seconds'));

        $busy = Game::whereIn('status', ['placing', 'playing'])->where('mode', 'pvp')
            ->where('updated_at', '>=', now()->subMinutes(10))
            ->get(['player1_id', 'player2_id'])
            ->flatMap(fn ($g) => [(int) $g->player1_id, (int) $g->player2_id])->flip();

        $online = Presence::online()->where('user_id', '!=', $me)->orderBy('name')->get()
            ->map(fn ($p) => [
                'id' => $p->user_id,
                'name' => $p->name,
                'avatar' => $p->avatar,
                'busy' => isset($busy[$p->user_id]) || $p->game_id !== null,
            ]);

        $invites = Game::where('status', 'invited')->where('player2_id', $me)
            ->where('created_at', '>=', $inviteSince)->latest()->get()
            ->map(fn ($g) => ['id' => $g->id, 'from' => $g->player1_name, 'url' => route('games.show', $g)]);

        $active = Game::involving($me)->whereIn('status', ['placing', 'playing'])
            ->latest('updated_at')->take(5)->get()
            ->map(fn ($g) => [
                'id' => $g->id,
                'url' => route('games.show', $g),
                'vs' => $g->slotOf($me) === 1 ? $g->player2_name : $g->player1_name,
                'status' => $g->status,
                'my_turn' => $g->status === 'playing' && (int) $g->turn === $g->slotOf($me),
            ]);

        $chat = ChatMessage::whereNull('game_id')
            ->where('id', '>', (int) $request->query('chat_after', 0))
            ->latest('id')->take(50)->get()->reverse()->map->toClient()->values();

        return response()->json([
            'online' => $online,
            'invites' => $invites,
            'active' => $active,
            'chat' => $chat,
            'ranking' => $this->ranking(),
            'my_stats' => $this->ranking(all: true)->firstWhere('id', $me),
        ]);
    }

    /**
     * Ranking de almirantes: victoria PvP = 3 pts, contra CPU = 1/2/3 pts según dificultad.
     */
    private function ranking(bool $all = false)
    {
        $rows = Cache::remember('bs:ranking', 20, function () {
            $points = ['easy' => 1, 'normal' => 2, 'hard' => 3];
            $table = [];
            $add = function ($id, $name, $key, $pts = 0) use (&$table) {
                $table[$id] ??= ['id' => (int) $id, 'name' => $name, 'wins' => 0, 'losses' => 0, 'points' => 0];
                $table[$id][$key]++;
                $table[$id]['points'] += $pts;
            };

            Game::where('status', 'finished')->get()->each(function (Game $g) use ($add, $points) {
                if ($g->isCpu()) {
                    $g->winner === 1
                        ? $add($g->player1_id, $g->player1_name, 'wins', $points[$g->difficulty] ?? 1)
                        : $add($g->player1_id, $g->player1_name, 'losses');

                    return;
                }
                $w = (int) $g->winner;
                $add($g->playerId($w), $g->playerName($w), 'wins', 3);
                $add($g->playerId(3 - $w), $g->playerName(3 - $w), 'losses');
            });

            return collect($table)->sortByDesc(fn ($r) => [$r['points'], $r['wins']])->values()->all();
        });

        return $all ? collect($rows) : collect($rows)->take(10)->values();
    }
}
