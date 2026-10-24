@extends('layouts.app')

@section('title', 'Pac-Man')
@section('brand', 'PAC-MAN')
@section('brand-sub', 'SIOS ARCADE')

@section('content')
<main class="pac-page">
    <div class="pac-stage">
        <section class="panel pac-hud">
            <div><b id="hud-score">0</b><span>Puntos</span></div>
            <div><b id="hud-best">{{ number_format($best) }}</b><span>Tu récord</span></div>
            <div><b id="hud-level">1</b><span>Nivel</span></div>
            <div><div class="pac-lives" id="hud-lives"></div><span>Vidas</span></div>
        </section>

        <div class="pac-screen">
            <canvas id="pac-canvas" width="448" height="496"></canvas>
            <div class="pac-overlay" id="pac-overlay">
                <div>
                    <h2>PAC-MAN</h2>
                    <p>Come todos los puntos y evita a los fantasmas.<br>Las píldoras grandes los vuelven vulnerables… ¡a comer!</p>
                    <button class="btn big" id="btn-start" style="--c1:#ffd23d;--c2:#d18a00;color:#04121f">▶ Jugar</button>
                    <div class="keys">Flechas / WASD para moverte · <span class="kbd">P</span> pausa · desliza el dedo en celular</div>
                </div>
            </div>
        </div>

        <div class="pac-dpad" id="pac-dpad">
            <button data-dir="up" aria-label="Arriba">▲</button>
            <button data-dir="left" aria-label="Izquierda">◀</button>
            <button data-dir="down" aria-label="Abajo">▼</button>
            <button data-dir="right" aria-label="Derecha">▶</button>
        </div>
    </div>

    <aside class="pac-side">
        <section class="panel">
            <div class="panel-head" style="color:#ffd23d">🏆 Salón de la fama</div>
            <div class="panel-body">
                <table class="ranking" id="pac-ranking"></table>
            </div>
        </section>
        <section class="panel">
            <div class="panel-head">👻 Conoce a los fantasmas</div>
            <div class="panel-body legend">
                <div><span class="swatch" style="background:#ff3355"></span><span><b style="color:#fff">Rojo</b> · te persigue directamente.</span></div>
                <div><span class="swatch" style="background:#ff9ad6"></span><span><b style="color:#fff">Rosa</b> · intenta emboscarte por delante.</span></div>
                <div><span class="swatch" style="background:#3ff2ff"></span><span><b style="color:#fff">Cian</b> · impredecible, trabaja en equipo con Rojo.</span></div>
                <div><span class="swatch" style="background:#ffb347"></span><span><b style="color:#fff">Naranja</b> · se acerca… y luego huye.</span></div>
                <div style="margin-top:6px">⚪ 10 pts · 🔵 50 pts · 👻 200→1600 · 🍒 frutas hasta 5000 · vida extra a los 10,000</div>
            </div>
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script nonce="{{ $cspNonce }}">
        window.PAC = {
            best: {{ $best }},
            leaderboard: @json($leaderboard),
        };
    </script>
    <script src="{{ asset('assets/js/pacman.js') }}?v={{ filemtime(public_path('assets/js/pacman.js')) }}"></script>
@endpush
