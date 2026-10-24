@extends('layouts.app')

@section('title', 'Serpiente')
@section('brand', 'SERPIENTE')
@section('brand-sub', 'SIOS ARCADE')

@section('content')
<main class="pac-page arcade-snake">
    <div class="pac-stage">
        <section class="panel pac-hud">
            <div><b id="hud-score">0</b><span>Puntos</span></div>
            <div><b id="hud-best">0</b><span>Tu récord</span></div>
            <div><b id="hud-len">3</b><span>Longitud</span></div>
            <div><b id="hud-power">—</b><span>Poder</span></div>
        </section>

        <div class="pac-screen snake-screen">
            <canvas id="snake-canvas" width="672" height="480"></canvas>
            <div class="pac-overlay" id="snake-overlay">
                <div>
                    <h2 class="snake-title">SERPIENTE</h2>
                    <p>Come manzanas para crecer. No choques con las paredes, las rocas ni contigo.</p>
                    <div class="ms-levels snake-modes" id="snake-modes">
                        @foreach ($modes as $key => $name)
                            <button type="button" data-mode="{{ $key }}">{{ $name }}<small>{{ $key === 'wrap' ? 'Atraviesas los bordes' : 'Los bordes son muros' }}</small></button>
                        @endforeach
                    </div>
                    <button class="btn big" id="btn-start" style="--c1:#3dffa0;--c2:#0c8a5a;color:#04121f;margin-top:16px">▶ Jugar</button>
                    <div class="keys">Flechas / WASD · <span class="kbd">P</span> pausa · desliza en celular</div>
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
            <div class="panel-head" style="color:#3dffa0">🏆 Mejores serpientes</div>
            <div class="panel-body">
                <div class="ms-tabs" id="snake-tabs" style="grid-template-columns: repeat({{ count($modes) }}, 1fr)">
                    @foreach ($modes as $key => $name)
                        <button type="button" data-tab="{{ $key }}">{{ $name }}</button>
                    @endforeach
                </div>
                <table class="ranking" id="snake-ranking"></table>
            </div>
        </section>
        <section class="panel">
            <div class="panel-head">✨ Power-ups</div>
            <div class="panel-body legend">
                <div><span class="swatch" style="background:#ff3355;box-shadow:0 0 8px #ff3355"></span><span><b style="color:#fff">Manzana</b> · 10 pts y creces.</span></div>
                <div><span class="swatch" style="background:#ffd23d;box-shadow:0 0 8px #ffd23d"></span><span><b style="color:#fff">Estrella</b> · 50 pts, ¡desaparece pronto!</span></div>
                <div><span class="swatch" style="background:#a78bfa;box-shadow:0 0 8px #a78bfa"></span><span><b style="color:#fff">×2</b> · puntos dobles por 8 s.</span></div>
                <div><span class="swatch" style="background:#3ff2ff;box-shadow:0 0 8px #3ff2ff"></span><span><b style="color:#fff">Hielo</b> · cámara lenta por 6 s.</span></div>
                <div><span class="swatch" style="background:#5b6475"></span><span><b style="color:#fff">Rocas</b> · aparecen conforme creces. ¡Esquívalas!</span></div>
            </div>
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script nonce="{{ $cspNonce }}">
        window.SNAKE = {
            modes: @json($modes),
            leaderboards: @json($leaderboards),
            best: @json($best),
        };
    </script>
    <script src="{{ asset('assets/js/snake.js') }}?v={{ filemtime(public_path('assets/js/snake.js')) }}"></script>
@endpush
