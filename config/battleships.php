<?php

return [

    /*
     * URL pública de SIOS. Se usa para mostrar el avatar de cada usuario
     * (SIOS lo guarda en storage/avatars). Si se deja vacío se muestran iniciales.
     */
    'sios_url' => rtrim((string) env('SIOS_URL', ''), '/'),

    /*
     * Roles de SIOS (spatie/laravel-permission) que pueden jugar, separados
     * por comas. Vacío = cualquier usuario de SIOS puede jugar.
     */
    'allowed_roles' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('BATTLESHIPS_ALLOWED_ROLES', ''))
    ))),

    // Segundos sin actividad para dejar de considerar a un usuario "en línea".
    'online_seconds' => 25,

    // Segundos que dura vigente una invitación a jugar.
    'invite_seconds' => 120,

    // Segundos sin actividad del rival tras los cuales se puede reclamar la victoria.
    'abandon_seconds' => 120,

    'board_size' => 10,

    // Flota clásica: tipo => [nombre, tamaño]
    'fleet' => [
        'carrier' => ['name' => 'Portaaviones', 'size' => 5],
        'battleship' => ['name' => 'Acorazado', 'size' => 4],
        'cruiser' => ['name' => 'Crucero', 'size' => 3],
        'submarine' => ['name' => 'Submarino', 'size' => 3],
        'destroyer' => ['name' => 'Destructor', 'size' => 2],
    ],

    'difficulties' => [
        'easy' => 'Recluta',
        'normal' => 'Capitán',
        'hard' => 'Almirante',
    ],
];
