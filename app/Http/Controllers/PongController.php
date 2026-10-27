<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ManagesRooms;
use App\Models\ArcadeRoom;
use App\Models\ArcadeScore;
use App\Models\Presence;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Ping Pong: contra la CPU o contra otro usuario (salas de 2).
 *
 * En línea, la pelota la "posee" el jugador hacia el que se dirige: su
 * navegador decide si la devuelve o si se le escapa, así cada quien juega
 * con su propia paleta sin retraso.
 */
class PongController extends Controller
{
    use ManagesRooms;

    private const COLORS = ['#3ff2ff', '#ff3399'];

    public function index(Request $request)
    {
        Presence::touchUser($request->user());
        $me = (int) $request->user()->getKey();

        return view('pong', [
            'leaderboard' => self::leaderboard(),
            'mine' => collect(self::leaderboard(null))->firstWhere('user_id', $me),
            'colors' => self::COLORS,
            'target' => config('arcade.pong.points_to_win'),
        ]);
    }

    /**
     * Guarda el resultado de una partida (una fila por partida jugada).
     */
    public function store(Request $request)
    {
        $user = $request->user();
        $me = (int) $user->getKey();
        $target = config('arcade.pong.points_to_win');
        $data = $request->validate([
            'mode' => ['required', Rule::in(array_keys(config('arcade.pong.ranking_points')))],
            'me' => ['required', 'integer', 'min:0', 'max:'.$target],
            'opp' => ['required', 'integer', 'min:0', 'max:'.$target],
            'duration' => ['required', 'integer', 'min:5', 'max:86400'],
            'room_id' => ['required_if:mode,pvp', 'nullable', 'integer'],
        ]);

        // Una partida termina cuando alguien llega a la meta, y no ambos.
        if (max($data['me'], $data['opp']) !== $target || $data['me'] === $data['opp']) {
            throw ValidationException::withMessages(['me' => 'Marcador no válido.']);
        }

        $meta = ['me' => $data['me'], 'opp' => $data['opp']];
        if ($data['mode'] === 'pvp') {
            $room = ArcadeRoom::where('game', 'pong')->find($data['room_id']);
            if (! $room || $room->slotOf($me) === null || count($room->players) < 2) {
                throw ValidationException::withMessages(['room_id' => 'Sala no válida.']);
            }
            $already = ArcadeScore::where('game', 'pong')->where('user_id', $me)
                ->where('meta->room', $room->id)->exists();
            if ($already) {
                throw ValidationException::withMessages(['room_id' => 'El resultado de esta partida ya se guardó.']);
            }
            $meta['room'] = $room->id;
            $meta['rival'] = collect($room->players)->firstWhere('id', '!=', $me)['id'] ?? 0;
        }

        $key = 'pong:'.$me;
        if (RateLimiter::tooManyAttempts($key, 10)) {
            throw ValidationException::withMessages(['me' => 'Demasiados envíos, espera un momento.']);
        }
        RateLimiter::hit($key, 60);

        ArcadeScore::create([
            'game' => 'pong',
            'mode' => $data['mode'],
            'user_id' => $me,
            'user_name' => $user->name,
            'score' => $data['me'] > $data['opp'] ? 1 : 0,
            'duration' => $data['duration'],
            'meta' => $meta,
            'created_at' => now(),
        ]);

        $board = self::leaderboard(null);

        return response()->json([
            'leaderboard' => array_slice($board, 0, 10),
            'mine' => collect($board)->firstWhere('user_id', $me),
        ]);
    }

    /**
     * Ranking por puntos: cada victoria vale según el rival (config arcade.pong.ranking_points).
     */
    public static function leaderboard(?int $limit = 10): array
    {
        $points = config('arcade.pong.ranking_points');
        $rows = ArcadeScore::where('game', 'pong')->get(['user_id', 'user_name', 'mode', 'score'])
            ->groupBy('user_id')
            ->map(function ($games, $userId) use ($points) {
                $wins = $games->where('score', 1);

                return [
                    'user_id' => (int) $userId,
                    'name' => $games->last()->user_name,
                    'wins' => $wins->count(),
                    'losses' => $games->count() - $wins->count(),
                    'pvp_wins' => $wins->where('mode', 'pvp')->count(),
                    'points' => $wins->sum(fn ($g) => $points[$g->mode] ?? 0),
                ];
            })
            ->sortByDesc(fn ($r) => [$r['points'], $r['wins']])->values();

        return ($limit ? $rows->take($limit) : $rows)->values()->all();
    }

    protected function roomGame(): string
    {
        return 'pong';
    }

    protected function maxPlayers(): int
    {
        return 2;
    }

    protected function roomColors(): array
    {
        return self::COLORS;
    }

    protected function roomAnnouncement(ArcadeRoom $room): string
    {
        return "🏓 Abrí una mesa de Ping Pong (#{$room->id}). ¿Quién se anima? Sala de juegos → Ping Pong.";
    }
}
