@extends('layouts.app')

@section('title', 'Asteroides')
@section('brand', 'ASTEROIDES')
@section('brand-sub', 'SIOS ARCADE')

@section('content')
<main class="pac-page arcade-ast">
    <div class="pac-stage">
        <div class="pac-screen ast-screen">
            <canvas id="ast-canvas" width="1280" height="720"></canvas>
            <div class="pac-overlay" id="ast-overlay"></div>
        </div>
        <div class="ast-touch" id="ast-touch">
            <button data-k="left" aria-label="Girar a la izquierda">⟲</button>
            <button data-k="right" aria-label="Girar a la derecha">⟳</button>
            <button data-k="thrust" aria-label="Impulso">▲</button>
            <button data-k="fire" class="fire" aria-label="Disparar">●</button>
        </div>
    </div>

    <aside class="pac-side">
        <section class="panel">
            <div class="panel-head" style="color:#ff3399">🏆 Mejores pilotos</div>
            <div class="panel-body"><table class="ranking" id="ast-ranking"></table></div>
        </section>
        <section class="panel">
            <div class="panel-head">🎮 Controles</div>
            <div class="panel-body legend">
                <div><span class="kbd">←</span><span class="kbd">→</span> girar · <span class="kbd">↑</span> impulso</div>
                <div><span class="kbd">Espacio</span> disparar (mantén para ráfaga)</div>
                <div><span class="kbd">↓</span> / <span class="kbd">H</span> hiperespacio (¡arriesgado!)</div>
                <div><span class="kbd">P</span> pausa (solo en modo individual)</div>
                <div style="margin-top:6px">🪨 Grande 20 · mediano 50 · chico 100 · 🛸 platillo 200 / 1000 · ❤ vida extra cada 10,000</div>
                <div>👥 En equipo, todos pelean contra los asteroides; cada quien suma su propio puntaje.</div>
            </div>
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script nonce="{{ $cspNonce }}">
        window.AST = {
            best: {{ $best }},
            leaderboard: @json($leaderboard),
            colors: @json($colors),
            me: { id: {{ auth()->id() }}, name: @json(auth()->user()->name) },
        };
    </script>
    <script src="{{ asset('assets/js/asteroids.js') }}?v={{ filemtime(public_path('assets/js/asteroids.js')) }}"></script>
@endpush
