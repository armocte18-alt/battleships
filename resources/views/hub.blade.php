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
                        @elseif ($key === 'minesweeper')
                            <div class="art-mines">
                                @foreach (str_split('1 2F1  1F3F2 112 1  1   1 111 12F2 1F2  2F31 1  1 22    1111') as $c)
                                    <span class="{{ $c === ' ' ? 'o' : ($c === 'F' ? 'f' : 'n n'.$c) }}">{{ $c === 'F' ? '' : trim($c) }}</span>
                                @endforeach
                            </div>
                        @elseif ($key === 'asteroids')
                            <div class="art-space">
                                <svg viewBox="0 0 400 190" preserveAspectRatio="xMidYMid slice">
                                    <g fill="none" stroke-width="2.5" stroke-linejoin="round">
                                        <path class="rock r1" d="M60 40 l30 -12 l28 10 l6 28 l-18 24 l-30 2 l-20 -20 z" stroke="#c4b5fd"/>
                                        <path class="rock r2" d="M300 120 l20 -10 l22 8 l2 22 l-16 14 l-24 -4 l-8 -16 z" stroke="#c4b5fd"/>
                                        <path class="rock r3" d="M330 30 l12 -4 l10 8 l-2 12 l-12 4 l-10 -8 z" stroke="#c4b5fd"/>
                                        <g class="ship-a"><path d="M0 -14 L10 12 L0 6 L-10 12 Z" stroke="#3ff2ff" fill="rgba(63,242,255,.15)"/></g>
                                        <g class="ship-b"><path d="M0 -14 L10 12 L0 6 L-10 12 Z" stroke="#ff3399" fill="rgba(255,51,153,.15)"/></g>
                                        <g class="ship-c"><path d="M0 -14 L10 12 L0 6 L-10 12 Z" stroke="#ffc23d" fill="rgba(255,194,61,.15)"/></g>
                                    </g>
                                    <circle class="bolt" r="3" fill="#3ff2ff"/>
                                </svg>
                            </div>
                        @elseif ($key === 'pong')
                            <div class="art-pong">
                                <span class="pad l"></span><span class="pad r"></span>
                                <span class="net"></span><span class="ball"></span>
                            </div>
                        @elseif ($key === 'snake')
                            <div class="art-snakebox">
                                <div class="snake-body">@for ($i = 0; $i < 9; $i++)<i style="--i: {{ $i }}"></i>@endfor</div>
                                <span class="apple"></span>
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
    <script nonce="{{ $cspNonce }}">window.BS_HUB = { battleships: @json(route('lobby')) };</script>
    <script src="{{ asset('assets/js/hub.js') }}?v={{ filemtime(public_path('assets/js/hub.js')) }}"></script>
@endpush
