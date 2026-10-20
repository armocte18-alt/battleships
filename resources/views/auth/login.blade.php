@extends('layouts.app')

@section('title', 'Ingresar')

@section('content')
<main class="login-wrap">
    <div class="panel login-card">
        <svg class="login-logo" viewBox="0 0 400 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <defs>
                <linearGradient id="lh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b5c3ce"/><stop offset="1" stop-color="#3a4652"/></linearGradient>
            </defs>
            <path d="M20 80 Q200 60 380 80" stroke="#3ff2ff" stroke-opacity=".4" stroke-width="2" fill="none"/>
            <path d="M30 78 L370 78 L340 112 L60 112 Z" fill="url(#lh)" stroke="#1d252c" stroke-width="3"/>
            <rect x="160" y="40" width="70" height="38" rx="4" fill="#9aa8b4" stroke="#3b4650" stroke-width="3"/>
            <rect x="170" y="48" width="50" height="8" rx="2" fill="#2fd1ff"/>
            <rect x="190" y="14" width="6" height="28" fill="#c9d4dc"/>
            <rect x="182" y="20" width="22" height="4" fill="#c9d4dc"/>
            <g fill="#5d6b78" stroke="#2e3740" stroke-width="3"><rect x="90" y="62" width="40" height="16" rx="6"/><rect x="260" y="62" width="40" height="16" rx="6"/></g>
            <path d="M92 66 L50 58 M128 66 L60 52 M298 66 L345 56 M262 66 L340 50" stroke="#2b333b" stroke-width="5" stroke-linecap="round"/>
            <rect x="240" y="50" width="12" height="28" fill="#c23a6f"/>
            <path d="M0 118 Q 50 108 100 118 T 200 118 T 300 118 T 400 118" stroke="#3ff2ff" stroke-width="3" fill="none" opacity=".7"/>
        </svg>
        <h1 class="login-title">BATTLESHIPS</h1>
        <p class="login-sub">Batalla naval · SIOS</p>

        @if ($errors->any())
            <div class="error-box">{{ $errors->first() }}</div>
        @endif

        <form method="POST" action="{{ route('login') }}">
            @csrf
            <div class="field">
                <label for="login">Usuario o correo de SIOS</label>
                <input class="input" id="login" name="login" value="{{ old('login') }}" required autofocus autocomplete="username">
            </div>
            <div class="field">
                <label for="password">Contraseña</label>
                <input class="input" id="password" type="password" name="password" required autocomplete="current-password">
            </div>
            <button class="btn fire big" type="submit" style="width:100%">⚓ Zarpar</button>
        </form>
        <p class="login-foot">Usa las mismas credenciales con las que entras a SIOS.</p>
    </div>
</main>
@endsection
