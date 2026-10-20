<?php

namespace App\Services;

use Illuminate\Validation\ValidationException;

/**
 * Reglas de la flota: tipos de barco, validación de posiciones y colocación aleatoria.
 *
 * Un tablero se guarda como lista de barcos: [['type' => 'carrier', 'x' => 0, 'y' => 0, 'dir' => 'h'], ...]
 */
class Fleet
{
    public static function size(): int
    {
        return (int) config('battleships.board_size');
    }

    /** @return array<string,int> tipo => tamaño */
    public static function sizes(): array
    {
        return array_map(fn ($s) => (int) $s['size'], config('battleships.fleet'));
    }

    /** @return array<int,array{0:int,1:int}> */
    public static function cells(array $ship): array
    {
        $len = self::sizes()[$ship['type']];
        $cells = [];
        for ($i = 0; $i < $len; $i++) {
            $cells[] = $ship['dir'] === 'h' ? [$ship['x'] + $i, $ship['y']] : [$ship['x'], $ship['y'] + $i];
        }

        return $cells;
    }

    /**
     * Valida la flota enviada por el cliente y la devuelve normalizada.
     */
    public static function validate(mixed $ships): array
    {
        $fail = fn (string $msg) => throw ValidationException::withMessages(['ships' => $msg]);

        if (! is_array($ships)) {
            $fail('Flota inválida.');
        }

        $sizes = self::sizes();
        $n = self::size();
        $taken = [];
        $result = [];

        foreach ($ships as $ship) {
            $type = $ship['type'] ?? null;
            $dir = $ship['dir'] ?? null;
            $x = filter_var($ship['x'] ?? null, FILTER_VALIDATE_INT);
            $y = filter_var($ship['y'] ?? null, FILTER_VALIDATE_INT);

            if (! is_string($type) || ! isset($sizes[$type]) || isset($result[$type])) {
                $fail('Tipo de barco inválido o repetido.');
            }
            if (! in_array($dir, ['h', 'v'], true) || $x === false || $y === false) {
                $fail('Posición de barco inválida.');
            }

            $normalized = ['type' => $type, 'x' => $x, 'y' => $y, 'dir' => $dir];
            foreach (self::cells($normalized) as [$cx, $cy]) {
                if ($cx < 0 || $cy < 0 || $cx >= $n || $cy >= $n) {
                    $fail('Un barco queda fuera del mapa.');
                }
                if (isset($taken["$cx,$cy"])) {
                    $fail('Dos barcos no pueden ocupar la misma casilla.');
                }
                $taken["$cx,$cy"] = true;
            }
            $result[$type] = $normalized;
        }

        if (count($result) !== count($sizes)) {
            $fail('Debes colocar todos los barcos de la flota.');
        }

        return array_values($result);
    }

    /**
     * Coloca la flota al azar, sin que los barcos se toquen entre sí.
     */
    public static function random(): array
    {
        $n = self::size();

        while (true) {
            $blocked = [];
            $ships = [];
            foreach (self::sizes() as $type => $len) {
                $placed = false;
                for ($try = 0; $try < 200 && ! $placed; $try++) {
                    $dir = random_int(0, 1) ? 'h' : 'v';
                    $x = random_int(0, $dir === 'h' ? $n - $len : $n - 1);
                    $y = random_int(0, $dir === 'v' ? $n - $len : $n - 1);
                    $ship = ['type' => $type, 'x' => $x, 'y' => $y, 'dir' => $dir];
                    $cells = self::cells($ship);
                    if (collect($cells)->contains(fn ($c) => isset($blocked["$c[0],$c[1]"]))) {
                        continue;
                    }
                    foreach ($cells as [$cx, $cy]) {
                        for ($dx = -1; $dx <= 1; $dx++) {
                            for ($dy = -1; $dy <= 1; $dy++) {
                                $blocked[($cx + $dx).','.($cy + $dy)] = true;
                            }
                        }
                    }
                    $ships[] = $ship;
                    $placed = true;
                }
                if (! $placed) {
                    continue 2;
                }
            }

            return $ships;
        }
    }

    /**
     * Barco que ocupa la casilla, o null si es agua.
     */
    public static function shipAt(array $board, int $x, int $y): ?array
    {
        foreach ($board as $ship) {
            foreach (self::cells($ship) as [$cx, $cy]) {
                if ($cx === $x && $cy === $y) {
                    return $ship;
                }
            }
        }

        return null;
    }
}
