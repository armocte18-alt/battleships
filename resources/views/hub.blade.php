@extends('layouts.app')

@section('title', 'Sala de juegos')

@section('content')
<main class="hub">
    <div class="hub-main">
        <section class="panel hub-hero">
            <div class="hub-hero-text">
                <span class="eyebrow">● Insert coin</span>
                <h1>SALA DE<br><span>JUEGOS</span></h1>
                <p>Hola, <b>{{ $user->name }}</b>. Elige un juego, rompe récords y reta a tus compañeros de SIOS.</p>
            </div>
            <div class="hub-hero-art" aria-hidden="true">
                <div class="mini-pac-row">
                    <span class="mini-pac"></span>
                    @for ($i = 0; $i < 6; $i++)<i></i>@endfor
                    <span class="mini-ghost g1"></span>
                </div>
                <div class="hub-ship" id="hub-ship"></div>
            </div>
        </section>

        <div class="game-grid">
            @foreach ($games as $key => $game)
                @php($enabled = $game['enabled'] && $game['route'])
                <article class="panel game-card {{ $enabled ? '' : 'soon' }}" style="--accent: {{ $game['accent'] }}">
                    <div class="game-art art-{{ $key }}">
                        @if ($key === 'battleships')
                            <div class="art-sea"></div>
                            <div class="art-ship" data-ship="carrier"></div>
                            <div class="art-shell"></div>
                        @elseif ($key === 'pacman')
                            <div class="art-maze"></div>
                            <div class="art-pac-row">
                                <span class="mini-pac big"></span>
                                @for ($i = 0; $i < 7; $i++)<i></i>@endfor
                                <span class="mini-ghost g1"></span><span class="mini-ghost g2"></span><span class="mini-ghost g3"></span>
                            </div>
                        @else
                            <div class="art-soon">?</div>
                        @endif
                        @unless ($enabled)<span class="soon-badge">Próximamente</span>@endunless
                    </div>
                    <div class="game-info">
                        <span class="game-tagline">{{ $game['tagline'] }} · {{ $game['players'] }}</span>
                        <h2>{{ $game['name'] }}</h2>
                        <p>{{ $game['description'] }}</p>
                        <div class="tags">@foreach ($game['tags'] as $tag)<span>{{ $tag }}</span>@endforeach</div>
                        @if (! empty($stats[$key]))
                            <div class="game-stats">
                                @foreach ($stats[$key] as $s)
                                    <div><b>{{ $s['value'] }}</b><span>{{ $s['label'] }}@if (! empty($s['hint'])) · {{ $s['hint'] }}@endif</span></div>
                                @endforeach
                            </div>
                        @endif
                        @if ($enabled)
                            <a class="btn big play-btn" href="{{ route($game['route']) }}">▶ Jugar</a>
                        @else
                            <button class="btn big ghost" disabled>En desarrollo</button>
                        @endif
                    </div>
                </article>
            @endforeach
        </div>
    </div>

    <aside class="lobby-side">
        <section class="panel">
            <div class="panel-head">🟢 Jugadores en línea <span class="count" id="online-count"></span></div>
            <div class="panel-body player-list" id="players"><div class="empty">Buscando jugadores…</div></div>
        </section>
        <section class="panel" style="display:flex; flex-direction:column; height: 460px;">
            <div class="panel-head">💬 Chat general</div>
            @include('partials.chat', ['id' => 'hub-chat', 'placeholder' => 'Mensaje para todos…'])
        </section>
    </aside>
</main>
@endsection

@push('scripts')
    <script>window.BS_HUB = { battleships: @json(route('lobby')) };</script>
    <script src="{{ asset('assets/js/hub.js') }}?v={{ filemtime(public_path('assets/js/hub.js')) }}"></script>
@endpush
