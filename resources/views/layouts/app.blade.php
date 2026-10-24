<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <meta name="bs-base" content="{{ url('/') }}">
    <meta name="bs-user" content="{{ auth()->id() }}">
    <title>@yield('title', 'Sala de juegos') · SIOS Arcade</title>
    <link rel="icon" type="image/svg+xml" href="{{ asset('assets/img/favicon.svg') }}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Montserrat:wght@400;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="{{ asset('assets/css/battleships.css') }}?v={{ filemtime(public_path('assets/css/battleships.css')) }}">
</head>
<body class="@yield('body-class')">
    <div class="sea-bg"><div class="grid-lines"></div></div>

    @auth
        <header class="topbar">
            <a href="{{ route('hub') }}" class="brand" title="Sala de juegos">
                @include('partials.logo')
                <div class="brand-title">@yield('brand', 'SIOS ARCADE')<small>@yield('brand-sub', 'SALA DE JUEGOS')</small></div>
            </a>
            @hasSection('brand')
                <a href="{{ route('hub') }}" class="btn sm ghost nav-hub">🎮 Juegos</a>
            @endif
            <div class="spacer"></div>
            @yield('topbar')
            <button class="icon-btn" id="sound-toggle" type="button" title="Sonido"></button>
            <div class="user-chip">
                <div class="avatar">
                    @if (auth()->user()->avatarUrl())
                        <img src="{{ auth()->user()->avatarUrl() }}" alt="" data-fallback="{{ auth()->user()->initials() }}">
                    @else
                        {{ auth()->user()->initials() }}
                    @endif
                </div>
                <span>{{ auth()->user()->name }}</span>
            </div>
            <form method="POST" action="{{ route('logout') }}">
                @csrf
                <button class="icon-btn" title="Salir" type="submit">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
                </button>
            </form>
        </header>
    @endauth

    @yield('content')

    <script src="{{ asset('assets/js/core.js') }}?v={{ filemtime(public_path('assets/js/core.js')) }}"></script>
    @stack('scripts')
</body>
</html>
