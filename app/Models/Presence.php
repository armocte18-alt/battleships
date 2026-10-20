<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Presence extends Model
{
    public $timestamps = false;

    public $incrementing = false;

    protected $primaryKey = 'user_id';

    protected $guarded = [];

    protected $casts = ['last_seen_at' => 'datetime'];

    public static function touchUser(SiosUser $user, ?int $gameId = null): void
    {
        static::updateOrCreate(
            ['user_id' => $user->getKey()],
            ['name' => $user->name, 'avatar' => $user->avatarUrl(), 'game_id' => $gameId, 'last_seen_at' => now()]
        );
    }

    public function scopeOnline($query)
    {
        return $query->where('last_seen_at', '>=', now()->subSeconds(config('battleships.online_seconds')));
    }

    public static function isOnline(int $userId, ?int $seconds = null): bool
    {
        return static::where('user_id', $userId)
            ->where('last_seen_at', '>=', now()->subSeconds($seconds ?? config('battleships.online_seconds')))
            ->exists();
    }
}
