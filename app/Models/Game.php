<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Game extends Model
{
    public const CPU_ID = 0;

    protected $guarded = [];

    protected $casts = [
        'board1' => 'array',
        'board2' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function moves(): HasMany
    {
        return $this->hasMany(GameMove::class)->orderBy('id');
    }

    public function chat(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function isCpu(): bool
    {
        return $this->mode === 'cpu';
    }

    public function isActive(): bool
    {
        return in_array($this->status, ['placing', 'playing'], true);
    }

    /**
     * Número de jugador (1 o 2) del usuario, o null si no participa.
     */
    public function slotOf(int $userId): ?int
    {
        if ((int) $this->player1_id === $userId) {
            return 1;
        }
        if (! $this->isCpu() && (int) $this->player2_id === $userId) {
            return 2;
        }

        return null;
    }

    public function playerId(int $slot): ?int
    {
        return $slot === 1 ? (int) $this->player1_id : ($this->isCpu() ? self::CPU_ID : (int) $this->player2_id);
    }

    public function playerName(int $slot): string
    {
        return $slot === 1 ? $this->player1_name : $this->player2_name;
    }

    public function board(int $slot): ?array
    {
        return $slot === 1 ? $this->board1 : $this->board2;
    }

    public function scopeInvolving($query, int $userId)
    {
        return $query->where(fn ($q) => $q->where('player1_id', $userId)
            ->orWhere(fn ($q) => $q->where('mode', 'pvp')->where('player2_id', $userId)));
    }
}
