@extends('layouts.app')

@section('title', 'Buscaminas')
@section('brand', 'BUSCAMINAS')
@section('brand-sub', 'SIOS ARCADE')

@section('content')
<main class="ms-page">
    <div class="ms-stage">
        <section class="panel ms-bar">
            <div class="ms-levels" id="ms-levels">
                @foreach ($levels as $key => $l)
                    <button type="button" data-level="{{ $key }}">{{ $l['name'] }}<small>{{ $l['cols'] }}×{{ $l['rows'] }} · {{ $l['mines'] }} 💣</small></button>
                @endforeach
            </div>
            <div class="ms-hud">
                <div class="ms-counter" title="Minas restantes"><span>💣</span><b id="ms-mines">000</b></div>
                <button class="ms-face" id="ms-face" type="button" title="Nueva partida (R)">🙂</button>
                <div class="ms-counter" title="Tiempo"><span>⏱</span><b id="ms-time">0.0</b></div>
            </div>
            <button class="btn sm ghost ms-mode" id="ms-mode" type="button" title="Cambiar entre excavar y marcar (F)">⛏ Excavar</button>
        </section>

        <div class="ms-wrap" id="ms-wrap">
            <div class="ms-board" id="ms-board"></div>
        </div>
        <p class="ms-tip">Clic para excavar · clic derecho (o mantener presionado) para poner bandera ·
            clic sobre un número con sus banderas completas para despejar alrededor · <span class="kbd">R</span> reiniciar</p>
    </div>

    <aside class="pac-side">
        <section class="panel">
            <div class="panel-head" style="color:#a78bfa">🏆 Mejores tiempos</div>
            <div class="panel-body">
                <div class="ms-tabs" id="ms-tabs">
                    @foreach ($levels as $key => $l)
                        <button type="button" data-tab="{{ $key }}">{{ $l['name'] }}</button>
                    @endforeach
                </div>
                <div class="ms-mybest" id="ms-mybest"></div>
                <table class="ranking" id="ms-ranking"></table>
            </div>
        </section>
        <section class="panel">
            <div class="panel-head">💡 Cómo se juega</div>
            <div class="panel-body legend">
                <div>🔢 Cada número indica cuántas minas tocan esa casilla (incluyendo diagonales).</div>
                <div>🚩 Marca con bandera donde estés seguro de que hay una mina.</div>
                <div>✨ El primer clic nunca es una mina y siempre abre una zona.</div>
                <div>🏁 Ganas al descubrir todas las casillas sin mina. ¡Contra reloj!</div>
            </div>
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script nonce="{{ $cspNonce }}">
        window.MS = {
            levels: @json($levels),
            leaderboards: @json($leaderboards),
            best: @json($best),
        };
    </script>
    <script src="{{ asset('assets/js/minesweeper.js') }}?v={{ filemtime(public_path('assets/js/minesweeper.js')) }}"></script>
@endpush
