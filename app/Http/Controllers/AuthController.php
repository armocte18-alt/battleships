<?php

namespace App\Http\Controllers;

use App\Models\SiosUser;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function showLogin()
    {
        return view('auth.login');
    }

    public function login(Request $request)
    {
        $data = $request->validate([
            'login' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string'],
        ], [], ['login' => 'usuario', 'password' => 'contraseña']);

        $key = 'login:'.Str::lower($data['login']).'|'.$request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            throw ValidationException::withMessages([
                'login' => 'Demasiados intentos. Intenta de nuevo en '.RateLimiter::availableIn($key).' segundos.',
            ]);
        }

        // Se puede entrar con el usuario o con el correo de SIOS.
        $field = str_contains($data['login'], '@') ? 'email' : 'username';

        if (! Auth::attempt([$field => $data['login'], 'password' => $data['password']])) {
            RateLimiter::hit($key);
            throw ValidationException::withMessages(['login' => 'Usuario o contraseña de SIOS incorrectos.']);
        }

        /** @var SiosUser $user */
        $user = Auth::user();
        if (! $user->canPlay()) {
            Auth::logout();
            throw ValidationException::withMessages(['login' => 'Tu usuario de SIOS no tiene permiso para jugar.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return redirect()->intended(route('lobby'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
