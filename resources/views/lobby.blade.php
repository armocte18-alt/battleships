@extends('layouts.app')

@section('title', 'Puerto')

@section('content')
<main class="lobby">
    <div class="lobby-main">
        <section class="panel hero">
            <div>
                <h1>¡A TODA<br>MÁQUINA!</h1>
                <p>Bienvenido al puerto, <b>{{ $user->name }}</b>. Despliega tu flota, desafía a tus compañeros de SIOS o
                    entrena contra el Almirante IA. Hunde los 5 barcos enemigos antes de que hundan los tuyos.</p>
                <div class="hero-stats" id="my-stats">
                    <div class="stat-pill"><b>–</b> victorias</div>
                    <div class="stat-pill"><b>–</b> derrotas</div>
                    <div class="stat-pill"><b>–</b> puntos</div>
                </div>
            </div>
            <div class="hero-ship" id="hero-ship"></div>
        </section>

        <div id="active-games-wrap" hidden>
            <section class="panel">
                <div class="panel-head">⚔ Batallas en curso</div>
                <div class="panel-body active-games" id="active-games"></div>
            </section>
        </div>

        <div class="modes">
            <section class="panel mode-card">
                <h2><span class="ico">🤖</span> Contra la CPU</h2>
                <p>Entrena contra el Almirante IA. Cada dificultad piensa distinto: el Almirante calcula probabilidades como un verdadero estratega.</p>
                <form id="cpu-form">
                    <div class="difficulty">
                        @foreach (config('battleships.difficulties') as $key => $label)
                            <label>
                                <input type="radio" name="difficulty" value="{{ $key }}" @checked($key === 'normal')>
                                <span><i>{{ str_repeat('★', $loop->iteration) }}</i>{{ $label }}</span>
                            </label>
                        @endforeach
                    </div>
                    <button class="btn fire big" type="submit" style="width:100%; margin-top:14px">🚀 Zarpar contra la CPU</button>
                </form>
            </section>

            <section class="panel mode-card">
                <h2><span class="ico">👥</span> Contra un compañero</h2>
                <p>Elige a un jugador conectado y envíale un desafío. Cuando acepte, ambos despliegan su flota y comienza el combate.</p>
                <div class="player-list" id="players">
                    <div class="empty">Buscando marineros en el radar…</div>
                </div>
            </section>
        </div>
    </div>

    <aside class="lobby-side">
        <section class="panel">
            <div class="panel-head">🏆 Ranking de almirantes</div>
            <div class="panel-body">
                <table class="ranking" id="ranking"><tr><td class="empty">Sin batallas registradas todavía.</td></tr></table>
            </div>
        </section>
        <section class="panel" style="display:flex; flex-direction:column; height: 460px;">
            <div class="panel-head">💬 Radio del puerto <span class="count" id="online-count"></span></div>
            @include('partials.chat', ['id' => 'lobby-chat', 'placeholder' => 'Mensaje para todo el puerto…'])
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script src="{{ asset('assets/js/lobby.js') }}?v={{ filemtime(public_path('assets/js/lobby.js')) }}"></script>
@endpush
