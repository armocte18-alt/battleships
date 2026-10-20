<?php

namespace Tests\Unit;

use App\Services\CpuPlayer;
use App\Services\Fleet;
use Tests\TestCase;

class CpuPlayerTest extends TestCase
{
    public function test_every_difficulty_sinks_a_random_fleet_without_repeating_shots(): void
    {
        foreach (['easy' => 100, 'normal' => 80, 'hard' => 70] as $difficulty => $maxShots) {
            $board = Fleet::random();
            $shots = [];
            $sunkCells = [];
            $hits = [];
            $sunk = [];

            while (count($sunk) < 5) {
                $remaining = collect($board)->reject(fn ($s) => isset($sunk[$s['type']]))->map(fn ($s) => Fleet::sizes()[$s['type']])->values()->all();
                [$x, $y] = CpuPlayer::chooseShot($difficulty, $shots, $sunkCells, $remaining);
                $this->assertArrayNotHasKey("$x,$y", $shots, "$difficulty repitió disparo");

                $ship = Fleet::shipAt($board, $x, $y);
                $shots["$x,$y"] = $ship ? 'hit' : 'miss';
                if ($ship) {
                    $hits["$x,$y"] = true;
                    $cells = Fleet::cells($ship);
                    if (collect($cells)->every(fn ($c) => isset($hits["$c[0],$c[1]"]))) {
                        $sunk[$ship['type']] = true;
                        foreach ($cells as $c) {
                            $sunkCells["$c[0],$c[1]"] = true;
                        }
                    }
                }
            }

            $this->assertLessThanOrEqual($maxShots, count($shots), "$difficulty tardó demasiado");
        }
    }
}
