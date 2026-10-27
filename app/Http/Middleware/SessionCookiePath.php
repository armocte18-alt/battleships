<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Limita las cookies de sesión y CSRF a la carpeta desde la que se abrió el
 * sitio (por ejemplo /battle_ships), calculada en cada petición. Así no
 * chocan con las de SIOS y siguen funcionando aunque el juego se abra con
 * otra ruta, otras mayúsculas o un virtual host (evita el error 419).
 */
class SessionCookiePath
{
    public function handle(Request $request, Closure $next): Response
    {
        config(['session.path' => rtrim($request->getBasePath(), '/') ?: '/']);

        return $next($request);
    }
}
