@extends('layouts.app')

@section('title', 'Batalla #'.$game->id)

@section('topbar')
    <a href="{{ route('lobby') }}" class="btn sm ghost">⚓ Puerto</a>
@endsection

@section('brand', 'BATTLESHIPS')
@section('brand-sub', 'SIOS · BATALLA NAVAL')

@section('content')
<main class="game">
    <div class="game-main">
        <section class="panel hud">
            <div class="hud-player" id="hud-me"></div>
            <div class="turn-banner" id="turn-banner">Cargando…</div>
            <div class="hud-player right" id="hud-enemy"></div>
        </section>
        <div id="stage"></div>
    </div>

    <aside class="game-side">
        <section class="panel">
            <div class="mini-stats">
                <div><b id="st-shots">0</b><span>Disparos</span></div>
                <div><b id="st-acc">0%</b><span>Precisión</span></div>
                <div><b id="st-sunk">0/5</b><span>Hundidos</span></div>
                <div><b id="st-lost">0/5</b><span>Perdidos</span></div>
                <div class="actions">
                    <button class="btn sm wine" id="btn-claim" hidden>🏳 Reclamar victoria</button>
                    <button class="btn sm ghost" id="btn-forfeit" hidden>🏳 Rendirse</button>
                </div>
            </div>
        </section>
        <section class="panel chat-panel">
            <div class="panel-head">💬 Radio de combate</div>
            @include('partials.chat', [
                'id' => 'game-chat',
                'placeholder' => $game->isCpu() ? 'Provoca a la IA… (no responde mucho)' : 'Mensaje para tu rival…',
                'empty' => $game->isCpu() ? 'El Almirante IA escucha la radio… y a veces contesta.' : 'Canal privado con tu rival.',
            ])
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script>
        window.BS_GAME = {
            id: {{ $game->id }},
            fleet: @json(collect(config('battleships.fleet'))->map(fn ($s, $k) => ['type' => $k] + $s)->values()),
        };
    </script>
    <script src="{{ asset('assets/js/game.js') }}?v={{ filemtime(public_path('assets/js/game.js')) }}"></script>
@endpush
