<?php

/*
 * Catálogo de la Sala de juegos. Para agregar un juego nuevo basta con
 * añadir una entrada aquí (y su ruta); con 'enabled' => false se muestra
 * como "Próximamente".
 */
return [
    'games' => [
        'battleships' => [
            'name' => 'Battleships',
            'tagline' => 'Batalla naval',
            'description' => 'Despliega tu flota y hunde los barcos enemigos. Reta a un compañero o enfrenta al Almirante IA.',
            'route' => 'lobby',
            'players' => '1–2 jugadores',
            'tags' => ['Estrategia', 'Multijugador', 'Chat'],
            'accent' => '#3ff2ff',
            'enabled' => true,
        ],
        'pacman' => [
            'name' => 'Pac-Man',
            'tagline' => 'Arcade clásico',
            'description' => 'Come todos los puntos del laberinto, esquiva a los fantasmas y conviértete en el récord de la oficina.',
            'route' => 'pacman',
            'players' => '1 jugador',
            'tags' => ['Arcade', 'Récords', 'Reflejos'],
            'accent' => '#ffd23d',
            'enabled' => true,
        ],
        'minesweeper' => [
            'name' => 'Buscaminas',
            'tagline' => 'Lógica clásica',
            'description' => 'Despeja el campo sin detonar ninguna mina. Tres niveles de dificultad y récords de tiempo.',
            'route' => 'minesweeper',
            'players' => '1 jugador',
            'tags' => ['Lógica', 'Récords', 'Contrarreloj'],
            'accent' => '#a78bfa',
            'enabled' => true,
        ],
        'asteroids' => [
            'name' => 'Asteroides',
            'tagline' => 'Arcade espacial',
            'description' => 'Pilota tu nave y pulveriza asteroides. Juega solo o en equipo con hasta dos compañeros.',
            'route' => 'asteroids',
            'players' => '1–3 jugadores',
            'tags' => ['Acción', 'Cooperativo', 'Récords'],
            'accent' => '#ff3399',
            'enabled' => true,
        ],
        'pong' => [
            'name' => 'Ping Pong',
            'tagline' => 'Duelo arcade',
            'description' => 'El clásico de las paletas con efectos de neón. Reta a la CPU o a un compañero desde su propia PC.',
            'route' => 'pong',
            'players' => '1–2 jugadores',
            'tags' => ['Duelo', 'Multijugador', 'Reflejos'],
            'accent' => '#ffc23d',
            'enabled' => true,
        ],
        'snake' => [
            'name' => 'Serpiente',
            'tagline' => 'Arcade',
            'description' => 'Come, crece y no choques. Power-ups, dos modos de juego y récords de la oficina.',
            'route' => 'snake',
            'players' => '1 jugador',
            'tags' => ['Arcade', 'Reflejos', 'Récords'],
            'accent' => '#3dffa0',
            'enabled' => true,
        ],
        'tetris' => [
            'name' => 'Bloques',
            'tagline' => 'Puzzle',
            'description' => 'Acomoda las piezas que caen y completa líneas.',
            'route' => null,
            'players' => '1 jugador',
            'tags' => ['Puzzle'],
            'accent' => '#c23a6f',
            'enabled' => false,
        ],
    ],

    /*
     * Juegos que guardan su puntaje en la tabla genérica arcade_scores.
     * max_per_second limita puntajes imposibles según el tiempo jugado.
     */
    'scores' => [
        'asteroids' => ['modes' => ['classic' => 'Clásico'], 'max_per_second' => 600, 'max' => 9999990, 'meta' => ['wave', 'players']],
        'snake' => ['modes' => ['classic' => 'Clásico', 'wrap' => 'Sin bordes'], 'max_per_second' => 120, 'max' => 999990, 'meta' => ['length']],
    ],

    // Salas en tiempo real (Asteroides, Ping Pong)
    'rooms' => [
        'idle_seconds' => 45, // una sala sin actividad deja de listarse
    ],

    'asteroids' => [
        'max_players' => 3,
    ],

    'pong' => [
        'points_to_win' => 7,
        // Puntos del ranking por victoria según el rival.
        'ranking_points' => ['cpu_easy' => 1, 'cpu_normal' => 2, 'cpu_hard' => 3, 'pvp' => 4],
    ],

    'minesweeper' => [
        // filas, columnas, minas y tiempo mínimo creíble (ms) para aceptar un récord.
        'levels' => [
            'easy' => ['name' => 'Principiante', 'rows' => 9, 'cols' => 9, 'mines' => 10, 'min_ms' => 1000],
            'medium' => ['name' => 'Intermedio', 'rows' => 16, 'cols' => 16, 'mines' => 40, 'min_ms' => 6000],
            'hard' => ['name' => 'Experto', 'rows' => 16, 'cols' => 30, 'mines' => 99, 'min_ms' => 20000],
        ],
    ],

    'pacman' => [
        // Puntaje máximo plausible por nivel (puntos + fantasmas + frutas); evita récords inventados.
        'max_score_per_level' => 26000,
        'min_seconds_per_level' => 15,
    ],
];
