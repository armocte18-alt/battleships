<?php

namespace Tests\Feature;

use App\Models\ArcadeRoom;
use App\Models\ArcadeScore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AsteroidsSnakeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSios();
    }

    public function test_pages_and_hub_cards(): void
    {
        $this->actingAs($this->siosUser('ana'))->get('/')->assertOk()
            ->assertSee('Asteroides')->assertSee('Serpiente')->assertSee(route('asteroids'))->assertSee(route('snake'));
        $this->get('/asteroides')->assertOk()->assertSee('ast-canvas');
        $this->get('/serpiente')->assertOk()->assertSee('snake-canvas');
    }

    public function test_rooms_hold_up_to_three_players_and_relay_state(): void
    {
        [$ana, $beto, $carla, $dani] = [$this->siosUser('ana'), $this->siosUser('beto'), $this->siosUser('carla'), $this->siosUser('dani')];

        $room = $this->actingAs($ana)->postJson('/asteroides/salas')->assertOk()->assertJsonPath('players.0.slot', 0)->json();
        $this->actingAs($beto)->getJson('/asteroides/salas')->assertJsonPath('rooms.0.id', $room['id']);
        $this->actingAs($beto)->postJson("/asteroides/salas/{$room['id']}/unirse")->assertJsonPath('players.1.slot', 1);
        $this->actingAs($carla)->postJson("/asteroides/salas/{$room['id']}/unirse")->assertJsonPath('players.2.slot', 2);
        $this->actingAs($dani)->postJson("/asteroides/salas/{$room['id']}/unirse")->assertStatus(422);
        $this->actingAs($dani)->postJson("/asteroides/salas/{$room['id']}/sync", ['x' => 1])->assertForbidden();

        // Solo el anfitrión inicia.
        $this->actingAs($beto)->postJson("/asteroides/salas/{$room['id']}/iniciar")->assertForbidden();
        $this->actingAs($ana)->postJson("/asteroides/salas/{$room['id']}/iniciar")->assertJsonPath('status', 'playing');

        // Relevo: el invitado recibe al anfitrión y el anfitrión a los invitados.
        $this->actingAs($beto)->postJson("/asteroides/salas/{$room['id']}/sync", ['s' => ['x' => 10]])->assertOk();
        $this->actingAs($carla)->postJson("/asteroides/salas/{$room['id']}/sync", ['s' => ['x' => 20]])->assertOk();
        $host = $this->actingAs($ana)->postJson("/asteroides/salas/{$room['id']}/sync", ['w' => 3])->assertOk()->json();
        $this->assertSame(10, $host['peers'][1]['d']['s']['x']);
        $this->assertSame(20, $host['peers'][2]['d']['s']['x']);
        $guest = $this->actingAs($beto)->postJson("/asteroides/salas/{$room['id']}/sync", ['s' => ['x' => 11]])->json();
        $this->assertSame(3, $guest['peers'][0]['d']['w']);
        $this->assertArrayNotHasKey(2, $guest['peers']);

        $this->actingAs($ana)->postJson("/asteroides/salas/{$room['id']}/terminar")->assertOk();
        $this->assertSame('finished', ArcadeRoom::find($room['id'])->status);
    }

    public function test_host_leaving_a_waiting_room_closes_it(): void
    {
        $ana = $this->siosUser('ana');
        $room = $this->actingAs($ana)->postJson('/asteroides/salas')->json();
        $this->actingAs($ana)->postJson("/asteroides/salas/{$room['id']}/salir")->assertOk();
        $this->assertSame('finished', ArcadeRoom::find($room['id'])->status);
    }

    public function test_generic_scores_for_asteroids_and_snake(): void
    {
        $ana = $this->siosUser('ana');
        $this->actingAs($ana)->postJson('/puntajes/asteroids', ['mode' => 'classic', 'score' => 12500, 'duration' => 300, 'meta' => ['wave' => 5, 'players' => 2]])
            ->assertOk()->assertJsonPath('new_best', true)->assertJsonPath('leaderboard.0.meta.wave', 5);
        $this->actingAs($ana)->postJson('/puntajes/snake', ['mode' => 'wrap', 'score' => 400, 'duration' => 90, 'meta' => ['length' => 30]])
            ->assertOk()->assertJsonPath('rank', 1);
        $this->actingAs($this->siosUser('beto'))->postJson('/puntajes/snake', ['mode' => 'wrap', 'score' => 900, 'duration' => 120])
            ->assertOk()->assertJsonPath('rank', 1)->assertJsonCount(2, 'leaderboard');

        $this->postJson('/puntajes/snake', ['mode' => 'wrap', 'score' => 90000, 'duration' => 10])->assertStatus(422);
        $this->postJson('/puntajes/snake', ['mode' => 'turbo', 'score' => 10, 'duration' => 10])->assertStatus(422);
        $this->postJson('/puntajes/tetris', ['mode' => 'x', 'score' => 1, 'duration' => 1])->assertNotFound();

        $this->assertSame(3, ArcadeScore::count());
        $this->actingAs($ana)->get('/')->assertSee('12,500');
    }
}
