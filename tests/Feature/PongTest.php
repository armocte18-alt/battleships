<?php

namespace Tests\Feature;

use App\Models\ArcadeRoom;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PongTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSios();
    }

    public function test_page_and_hub_card(): void
    {
        $this->actingAs($this->siosUser('ana'))->get('/')->assertOk()->assertSee('Ping Pong')->assertSee(route('pong'));
        $this->get('/pingpong')->assertOk()->assertSee('pong-canvas');
    }

    public function test_tables_are_for_two_players_and_separate_from_asteroids(): void
    {
        [$ana, $beto, $carla] = [$this->siosUser('ana'), $this->siosUser('beto'), $this->siosUser('carla')];

        $table = $this->actingAs($ana)->postJson('/pingpong/salas')->assertOk()->assertJsonPath('game', 'pong')->json();
        $this->actingAs($beto)->getJson('/asteroides/salas')->assertJsonCount(0, 'rooms');
        $this->actingAs($beto)->getJson('/pingpong/salas')->assertJsonPath('rooms.0.id', $table['id']);
        $this->actingAs($beto)->postJson("/asteroides/salas/{$table['id']}/unirse")->assertNotFound();
        $this->actingAs($beto)->postJson("/pingpong/salas/{$table['id']}/unirse")->assertJsonPath('players.1.slot', 1);
        $this->actingAs($carla)->postJson("/pingpong/salas/{$table['id']}/unirse")->assertStatus(422);

        $this->actingAs($ana)->postJson("/pingpong/salas/{$table['id']}/iniciar")->assertJsonPath('status', 'playing');
        $this->actingAs($beto)->postJson("/pingpong/salas/{$table['id']}/sync", ['p' => [300, 0], 'l' => 2])->assertOk();
        $host = $this->actingAs($ana)->postJson("/pingpong/salas/{$table['id']}/sync", ['p' => [200, 0], 'l' => 1])->json();
        $this->assertSame(2, $host['peers'][1]['d']['l']);
    }

    public function test_results_and_ranking(): void
    {
        [$ana, $beto, $carla] = [$this->siosUser('ana'), $this->siosUser('beto'), $this->siosUser('carla')];

        // Contra la CPU
        $this->actingAs($ana)->postJson('/pingpong/resultados', ['mode' => 'cpu_hard', 'me' => 7, 'opp' => 4, 'duration' => 120])
            ->assertOk()->assertJsonPath('mine.wins', 1)->assertJsonPath('mine.points', 3);
        // Marcadores imposibles
        $this->postJson('/pingpong/resultados', ['mode' => 'cpu_easy', 'me' => 5, 'opp' => 3, 'duration' => 60])->assertStatus(422);
        $this->postJson('/pingpong/resultados', ['mode' => 'cpu_easy', 'me' => 7, 'opp' => 7, 'duration' => 60])->assertStatus(422);

        // En línea: requiere una mesa real donde hayas jugado, una sola vez.
        $table = $this->actingAs($ana)->postJson('/pingpong/salas')->json();
        $this->actingAs($beto)->postJson("/pingpong/salas/{$table['id']}/unirse");
        $this->actingAs($carla)->postJson('/pingpong/resultados', ['mode' => 'pvp', 'me' => 7, 'opp' => 0, 'duration' => 60, 'room_id' => $table['id']])->assertStatus(422);
        $this->actingAs($beto)->postJson('/pingpong/resultados', ['mode' => 'pvp', 'me' => 7, 'opp' => 5, 'duration' => 90, 'room_id' => $table['id']])
            ->assertOk()->assertJsonPath('leaderboard.0.name', 'Beto Pérez')->assertJsonPath('leaderboard.0.points', 4);
        $this->actingAs($beto)->postJson('/pingpong/resultados', ['mode' => 'pvp', 'me' => 7, 'opp' => 5, 'duration' => 90, 'room_id' => $table['id']])->assertStatus(422);
        $this->actingAs($ana)->postJson('/pingpong/resultados', ['mode' => 'pvp', 'me' => 5, 'opp' => 7, 'duration' => 90, 'room_id' => $table['id']])
            ->assertOk()->assertJsonPath('mine.losses', 1)->assertJsonPath('mine.wins', 1);

        $this->assertSame('pong', ArcadeRoom::find($table['id'])->game);
        $this->actingAs($ana)->get('/')->assertSee('Beto Pérez');
    }
}
