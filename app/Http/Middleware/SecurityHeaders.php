<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\View;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Cabeceras de seguridad para todas las respuestas, incluida una
 * Content-Security-Policy que solo permite scripts propios del sitio
 * (archivos de /assets o bloques en línea con el nonce de la petición).
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        $nonce = Str::random(32);
        View::share('cspNonce', $nonce);

        $response = $next($request);

        $img = ["'self'", 'data:'];
        if ($sios = config('battleships.sios_url')) {
            $parts = parse_url($sios);
            if (! empty($parts['scheme']) && ! empty($parts['host'])) {
                $img[] = $parts['scheme'].'://'.$parts['host'].(isset($parts['port']) ? ':'.$parts['port'] : '');
            }
        }

        $csp = implode('; ', [
            "default-src 'self'",
            "script-src 'self' 'nonce-$nonce'",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com",
            'img-src '.implode(' ', $img),
            "connect-src 'self'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'self'",
        ]);

        $response->headers->set('Content-Security-Policy', $csp);
        $response->headers->set('X-Frame-Options', 'SAMEORIGIN');
        $response->headers->set('X-Content-Type-Options', 'nosniff');
        $response->headers->set('Referrer-Policy', 'same-origin');
        $response->headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $response->headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $response->headers->remove('X-Powered-By');

        return $response;
    }
}
