@extends('layouts.app')

@section('title', 'Ping Pong')
@section('brand', 'PING PONG')
@section('brand-sub', 'SIOS ARCADE')

@section('content')
<main class="pac-page arcade-ast arcade-pong">
    <div class="pac-stage">
        <div class="pac-screen pong-screen">
            <canvas id="pong-canvas" width="1280" height="720"></canvas>
            <div class="pac-overlay" id="pong-overlay"></div>
        </div>
        <p class="ms-tip">Mueve tu paleta con el <b>mouse</b> (o arrastrando el dedo) · también con <span class="kbd">W</span>/<span class="kbd">S</span> o <span class="kbd">↑</span>/<span class="kbd">↓</span> · <span class="kbd">P</span> pausa contra la CPU</p>
    </div>

    <aside class="pac-side">
        <section class="panel">
            <div class="panel-head" style="color:#ffc23d">🏆 Ranking de la mesa</div>
            <div class="panel-body">
                <div class="ms-mybest" id="pong-mine"></div>
                <table class="ranking" id="pong-ranking"></table>
            </div>
        </section>
        <section class="panel">
            <div class="panel-head">🏓 Reglas</div>
            <div class="panel-body legend">
                <div><span>Gana quien llegue primero a <b style="color:#fff">{{ $target }} puntos</b>.</span></div>
                <div><span>Pega con la orilla de la paleta para dar más ángulo; si la mueves al golpear, la pelota toma efecto.</span></div>
                <div><span>La pelota acelera en cada golpe. ¡Aguanta el peloteo!</span></div>
                <div style="margin-top:6px"><span>Puntos del ranking por victoria: CPU fácil 1 · normal 2 · difícil 3 · contra un compañero 4.</span></div>
            </div>
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script nonce="{{ $cspNonce }}">
        window.PONG = {
            leaderboard: @json($leaderboard),
            mine: @json($mine),
            colors: @json($colors),
            target: {{ $target }},
            me: { id: {{ auth()->id() }}, name: @json(auth()->user()->name) },
        };
    </script>
    <script src="{{ asset('assets/js/pong.js') }}?v={{ filemtime(public_path('assets/js/pong.js')) }}"></script>
@endpush
