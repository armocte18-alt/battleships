<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Usuario de SIOS. Vive en la base de datos de SIOS y aquí solo se lee:
 * el juego nunca crea, modifica ni borra usuarios.
 */
class SiosUser extends Authenticatable
{
    protected $connection = 'sios';

    protected $table = 'users';

    protected $hidden = ['password', 'remember_token'];

    protected $casts = ['password' => 'hashed'];

    /**
     * El token "recordarme" pertenece a SIOS; no lo tocamos.
     */
    public function getRememberTokenName()
    {
        return '';
    }

    public function avatarUrl(): ?string
    {
        $base = config('battleships.sios_url');

        return ($base && $this->avatar) ? $base.'/storage/'.ltrim($this->avatar, '/') : null;
    }

    public function initials(): string
    {
        return self::initialsFor($this->name);
    }

    public static function initialsFor(?string $name): string
    {
        $parts = preg_split('/\s+/', trim((string) $name)) ?: [];
        $initials = collect($parts)->filter()->take(2)->map(fn ($p) => Str::upper(Str::substr($p, 0, 1)))->implode('');

        return $initials ?: '?';
    }

    /**
     * ¿Tiene permitido jugar según BATTLESHIPS_ALLOWED_ROLES?
     */
    public function canPlay(): bool
    {
        $roles = config('battleships.allowed_roles');
        if (empty($roles)) {
            return true;
        }

        return DB::connection($this->getConnectionName())
            ->table('model_has_roles')
            ->join('roles', 'roles.id', '=', 'model_has_roles.role_id')
            ->where('model_has_roles.model_id', $this->getKey())
            ->where('model_has_roles.model_type', 'App\\Models\\User')
            ->whereIn('roles.name', $roles)
            ->exists();
    }
}
