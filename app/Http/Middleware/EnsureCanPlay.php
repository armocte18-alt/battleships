<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

/**
 * Si BATTLESHIPS_ALLOWED_ROLES está configurado, vuelve a comprobar cada
 * 10 minutos que el usuario conserve un rol permitido en SIOS; si se lo
 * quitaron, cierra su sesión.
 */
class EnsureCanPlay
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && config('battleships.allowed_roles')) {
            $checkedAt = (int) $request->session()->get('can_play_checked_at', 0);
            if ($checkedAt < now()->subMinutes(10)->getTimestamp()) {
                if (! $user->canPlay()) {
                    Auth::logout();
                    $request->session()->invalidate();
                    $request->session()->regenerateToken();

                    return $request->expectsJson()
                        ? response()->json(['message' => 'Tu usuario ya no tiene permiso para jugar.'], 401)
                        : redirect()->route('login')->withErrors(['login' => 'Tu usuario de SIOS ya no tiene permiso para jugar.']);
                }
                $request->session()->put('can_play_checked_at', now()->getTimestamp());
            }
        }

        return $next($request);
    }
}
