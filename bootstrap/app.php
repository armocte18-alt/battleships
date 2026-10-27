<?php

use App\Http\Middleware\EnsureCanPlay;
use App\Http\Middleware\SecurityHeaders;
use App\Http\Middleware\SessionCookiePath;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->web(prepend: [
            SessionCookiePath::class,
        ], append: [
            SecurityHeaders::class,
            EnsureCanPlay::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Sesión o formulario caducado (419): en vez de "Page Expired", regresa al login con un aviso.
        $exceptions->render(function (HttpException $e, Request $request) {
            if ($e->getStatusCode() !== 419 || $request->expectsJson()) {
                return null;
            }

            return redirect()->route('login')
                ->withInput($request->only('login'))
                ->withErrors(['login' => 'La página había caducado. Intenta de nuevo.']);
        });
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
    })->create();
