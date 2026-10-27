<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * Sala de juego en tiempo real (Asteroides, Ping Pong).
 */
class ArcadeRoom extends Model
{
    protected $guarded = [];

    protected $casts = ['players' => 'array'];

    /** Número de jugador (0 = anfitrión) o null si no está en la sala. */
    public function slotOf(int $userId): ?int
    {
        foreach ($this->players as $p) {
            if ((int) $p['id'] === $userId) {
                return (int) $p['slot'];
            }
        }

        return null;
    }

    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'game' => $this->game,
            'status' => $this->status,
            'host_id' => (int) $this->host_id,
            'seed' => (int) $this->seed,
            'players' => array_values($this->players),
        ];
    }
}
