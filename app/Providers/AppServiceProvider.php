<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $key = fn (Request $r) => $r->user()?->getKey() ?: $r->ip();

        // Uso normal del sitio (páginas y consultas periódicas).
        RateLimiter::for('arcade', fn (Request $r) => Limit::perMinute(300)->by('arcade:'.$key($r)));
        // Relevo en tiempo real de Asteroides (~10 por segundo por jugador).
        RateLimiter::for('sync', fn (Request $r) => Limit::perMinute(1200)->by('sync:'.$key($r)));
        // Acciones que generan avisos a otros usuarios.
        RateLimiter::for('invites', fn (Request $r) => Limit::perMinute(6)->by('invites:'.$key($r)));
        RateLimiter::for('rooms', fn (Request $r) => Limit::perMinute(4)->by('rooms:'.$key($r)));
    }
}
