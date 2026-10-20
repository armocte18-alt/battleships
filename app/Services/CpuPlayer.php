<?php

namespace App\Services;

/**
 * Inteligencia artificial de la CPU. Solo usa la información que tendría un jugador
 * humano: sus disparos anteriores, sus resultados y los barcos que ya hundió.
 */
class CpuPlayer
{
    /**
     * @param  array<string,string>  $shots  "x,y" => miss|hit|sunk
     * @param  array<string,bool>  $sunkCells  casillas de barcos ya hundidos
     * @param  int[]  $remaining  tamaños de los barcos que siguen a flote
     * @return array{0:int,1:int}
     */
    public static function chooseShot(string $difficulty, array $shots, array $sunkCells, array $remaining): array
    {
        $n = Fleet::size();
        $open = [];
        for ($y = 0; $y < $n; $y++) {
            for ($x = 0; $x < $n; $x++) {
                if (! isset($shots["$x,$y"])) {
                    $open[] = [$x, $y];
                }
            }
        }

        // Impactos que todavía no pertenecen a un barco hundido.
        $hits = [];
        foreach ($shots as $key => $result) {
            if ($result !== 'miss' && ! isset($sunkCells[$key])) {
                $hits[] = array_map('intval', explode(',', $key));
            }
        }

        return match ($difficulty) {
            'easy' => self::easy($open, $hits, $shots),
            'hard' => self::hard($open, $hits, $shots, $sunkCells, $remaining),
            default => self::normal($open, $hits, $shots),
        };
    }

    private static function pick(array $cells): array
    {
        return $cells[array_rand($cells)];
    }

    private static function neighbours(array $hits, array $shots): array
    {
        $n = Fleet::size();
        $out = [];
        foreach ($hits as [$x, $y]) {
            foreach ([[1, 0], [-1, 0], [0, 1], [0, -1]] as [$dx, $dy]) {
                $nx = $x + $dx;
                $ny = $y + $dy;
                if ($nx >= 0 && $ny >= 0 && $nx < $n && $ny < $n && ! isset($shots["$nx,$ny"])) {
                    $out["$nx,$ny"] = [$nx, $ny];
                }
            }
        }

        return array_values($out);
    }

    /** Recluta: dispara casi al azar y a veces remata un impacto. */
    private static function easy(array $open, array $hits, array $shots): array
    {
        $around = self::neighbours($hits, $shots);
        if ($around && random_int(1, 100) <= 45) {
            return self::pick($around);
        }

        return self::pick($open);
    }

    /** Capitán: caza en patrón de tablero de ajedrez y persigue la línea de impactos. */
    private static function normal(array $open, array $hits, array $shots): array
    {
        if ($hits) {
            // Si hay dos o más impactos alineados, sigue esa línea.
            $line = self::lineTargets($hits, $shots);
            if ($line) {
                return self::pick($line);
            }
            $around = self::neighbours($hits, $shots);
            if ($around) {
                return self::pick($around);
            }
        }

        $parity = array_values(array_filter($open, fn ($c) => ($c[0] + $c[1]) % 2 === 0));

        return self::pick($parity ?: $open);
    }

    private static function lineTargets(array $hits, array $shots): array
    {
        $n = Fleet::size();
        $set = [];
        foreach ($hits as [$x, $y]) {
            $set["$x,$y"] = true;
        }
        $targets = [];
        foreach ($hits as [$x, $y]) {
            foreach ([[1, 0], [0, 1]] as [$dx, $dy]) {
                if (! isset($set[($x + $dx).','.($y + $dy)])) {
                    continue;
                }
                // Extremos de la línea que contiene a (x,y) en esta dirección.
                foreach ([1, -1] as $sign) {
                    $cx = $x;
                    $cy = $y;
                    while (isset($set["$cx,$cy"])) {
                        $cx += $dx * $sign;
                        $cy += $dy * $sign;
                    }
                    if ($cx >= 0 && $cy >= 0 && $cx < $n && $cy < $n && ! isset($shots["$cx,$cy"])) {
                        $targets["$cx,$cy"] = [$cx, $cy];
                    }
                }
            }
        }

        return array_values($targets);
    }

    /** Almirante: mapa de densidad de probabilidad sobre todas las posiciones posibles. */
    private static function hard(array $open, array $hits, array $shots, array $sunkCells, array $remaining): array
    {
        $n = Fleet::size();
        $hitSet = [];
        foreach ($hits as [$x, $y]) {
            $hitSet["$x,$y"] = true;
        }
        $score = [];

        foreach ($remaining as $len) {
            foreach (['h', 'v'] as $dir) {
                for ($y = 0; $y < $n; $y++) {
                    for ($x = 0; $x < $n; $x++) {
                        $cells = [];
                        $covered = 0;
                        $valid = true;
                        for ($i = 0; $i < $len; $i++) {
                            $cx = $dir === 'h' ? $x + $i : $x;
                            $cy = $dir === 'v' ? $y + $i : $y;
                            $key = "$cx,$cy";
                            if ($cx >= $n || $cy >= $n || isset($sunkCells[$key])
                                || (($shots[$key] ?? null) === 'miss')) {
                                $valid = false;
                                break;
                            }
                            if (isset($hitSet[$key])) {
                                $covered++;
                            } else {
                                $cells[] = $key;
                            }
                        }
                        if (! $valid || ($hits && $covered === 0)) {
                            continue;
                        }
                        // Las posiciones que explican impactos existentes pesan mucho más.
                        $weight = $hits ? 30 ** $covered : 1;
                        foreach ($cells as $key) {
                            $score[$key] = ($score[$key] ?? 0) + $weight;
                        }
                    }
                }
            }
        }

        if (! $score) {
            return self::normal($open, $hits, $shots);
        }

        $max = max($score);
        $best = array_keys(array_filter($score, fn ($s) => $s === $max));

        return array_map('intval', explode(',', $best[array_rand($best)]));
    }
}
