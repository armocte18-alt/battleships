<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\ManagesRooms;
use App\Models\ArcadeRoom;
use App\Models\ArcadeScore;
use App\Models\Presence;
use Illuminate\Http\Request;

/**
 * Asteroides: modo solo y salas cooperativas de hasta 3 jugadores.
 *
 * Durante la partida el navegador del anfitrión simula el mundo (asteroides,
 * colisiones, puntos) y cada jugador controla su propia nave.
 */
class AsteroidsController extends Controller
{
    use ManagesRooms;

    private const COLORS = ['#3ff2ff', '#ff3399', '#ffc23d'];

    public function index(Request $request)
    {
        Presence::touchUser($request->user());

        return view('asteroids', [
            'leaderboard' => ArcadeScore::leaderboard('asteroids', 'classic'),
            'best' => ArcadeScore::bestOf((int) $request->user()->getKey(), 'asteroids'),
            'colors' => self::COLORS,
        ]);
    }

    protected function roomGame(): string
    {
        return 'asteroids';
    }

    protected function maxPlayers(): int
    {
        return config('arcade.asteroids.max_players');
    }

    protected function roomColors(): array
    {
        return self::COLORS;
    }

    protected function roomAnnouncement(ArcadeRoom $room): string
    {
        return "🚀 Abrí la sala de Asteroides #{$room->id}. ¡Únete desde la Sala de juegos → Asteroides! (hasta 3 jugadores)";
    }
}
