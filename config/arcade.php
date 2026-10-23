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
        'snake' => [
            'name' => 'Serpiente',
            'tagline' => 'Arcade',
            'description' => 'Crece sin chocar contigo mismo.',
            'route' => null,
            'players' => '1 jugador',
            'tags' => ['Arcade'],
            'accent' => '#3dffa0',
            'enabled' => false,
        ],
    ],

    'pacman' => [
        // Puntaje máximo plausible por nivel (puntos + fantasmas + frutas); evita récords inventados.
        'max_score_per_level' => 26000,
        'min_seconds_per_level' => 15,
    ],
];
