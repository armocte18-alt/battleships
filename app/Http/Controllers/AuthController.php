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

        // Límite por usuario+IP (adivinar una contraseña) y por IP (probar muchos usuarios).
        $key = 'login:'.Str::lower($data['login']).'|'.$request->ip();
        $ipKey = 'login-ip:'.$request->ip();
        foreach ([[$key, 5], [$ipKey, 20]] as [$k, $max]) {
            if (RateLimiter::tooManyAttempts($k, $max)) {
                throw ValidationException::withMessages([
                    'login' => 'Demasiados intentos. Intenta de nuevo en '.RateLimiter::availableIn($k).' segundos.',
                ]);
            }
        }

        // Se puede entrar con el usuario o con el correo de SIOS.
        $field = str_contains($data['login'], '@') ? 'email' : 'username';

        if (! Auth::attempt([$field => $data['login'], 'password' => $data['password']])) {
            RateLimiter::hit($key, 300);
            RateLimiter::hit($ipKey, 300);
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

        return redirect()->intended(route('hub'));
    }

    public function logout(Request $request)
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('login');
    }
}
