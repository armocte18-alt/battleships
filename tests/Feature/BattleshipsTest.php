<?php

namespace Tests\Feature;

use App\Models\Game;
use App\Services\Fleet;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class BattleshipsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSios();
    }

    private function fleet(): array
    {
        // Barcos en filas 0,2,4,6,8 empezando en x=0.
        return collect(array_keys(Fleet::sizes()))->values()
            ->map(fn ($type, $i) => ['type' => $type, 'x' => 0, 'y' => $i * 2, 'dir' => 'h'])->all();
    }

    public function test_guest_is_redirected_to_login(): void
    {
        $this->get('/')->assertRedirect('/login');
        $this->get('/login')->assertOk()->assertSee('SIOS ARCADE');
    }

    public function test_sios_user_logs_in_with_username_or_email_and_password_is_not_rewritten(): void
    {
        $user = $this->siosUser('ana');
        $hash = DB::connection('sios')->table('users')->value('password');

        $this->post('/login', ['login' => 'ana', 'password' => 'mal'])->assertSessionHasErrors('login');
        $this->post('/login', ['login' => 'ana', 'password' => 'secreto'])->assertRedirect('/');
        $this->assertAuthenticatedAs($user);
        $this->post('/logout');
        $this->post('/login', ['login' => 'ana@sios.test', 'password' => 'secreto'])->assertRedirect('/');

        $this->assertSame($hash, DB::connection('sios')->table('users')->value('password'));
        $this->get('/')->assertOk()->assertSee('Ana Pérez');
    }

    public function test_full_game_against_cpu(): void
    {
        $user = $this->siosUser('ana');
        $this->actingAs($user);

        $url = $this->postJson('/games/cpu', ['difficulty' => 'hard'])->assertOk()->json('url');
        $game = Game::firstOrFail();
        $this->assertSame('placing', $game->status);
        $this->get($url)->assertOk();

        // El estado nunca filtra la flota de la CPU.
        $this->getJson("/games/{$game->id}/state")->assertJsonPath('enemy_ships', []);

        $this->postJson("/games/{$game->id}/ships", ['ships' => $this->fleet()])
            ->assertOk()->assertJsonPath('status', 'playing')->assertJsonPath('turn', 1);

        // Disparo a todas las casillas hasta que termine la partida.
        $state = null;
        for ($y = 0; $y < 10 && ($state['status'] ?? 'playing') === 'playing'; $y++) {
            for ($x = 0; $x < 10; $x++) {
                $state = $this->postJson("/games/{$game->id}/fire", ['x' => $x, 'y' => $y])->assertOk()->json();
                if ($state['status'] !== 'playing') {
                    break;
                }
                $this->assertSame(1, $state['turn']); // la CPU respondió en la misma petición
            }
        }

        $this->assertSame('finished', $state['status']);
        $this->assertContains($state['winner'], [1, 2]);
        $this->assertCount(5, $state['enemy_ships']); // al final se revela todo
        $this->getJson('/lobby/poll')->assertOk()->assertJsonPath('ranking.0.id', $user->id);
    }

    public function test_pvp_invite_accept_place_and_fire_with_turns(): void
    {
        $ana = $this->siosUser('ana');
        $beto = $this->siosUser('beto');

        // Solo se puede retar a jugadores conectados.
        $this->actingAs($ana)->postJson('/games/invite', ['user_id' => $beto->id])->assertStatus(422);
        $this->actingAs($beto)->getJson('/lobby/poll')->assertOk();
        $this->actingAs($ana)->postJson('/games/invite', ['user_id' => $beto->id])->assertOk();
        $game = Game::firstOrFail();

        $this->actingAs($beto)->getJson('/lobby/poll')->assertJsonPath('invites.0.id', $game->id);
        $this->actingAs($beto)->postJson("/games/{$game->id}/accept")->assertOk();

        $this->actingAs($ana)->postJson("/games/{$game->id}/ships", ['ships' => $this->fleet()])->assertJsonPath('status', 'placing');
        $state = $this->actingAs($beto)->postJson("/games/{$game->id}/ships", ['ships' => $this->fleet()])->assertJsonPath('status', 'playing')->json();

        $first = $state['turn'] === 1 ? $ana : $beto;
        $second = $state['turn'] === 1 ? $beto : $ana;

        $this->actingAs($second)->postJson("/games/{$game->id}/fire", ['x' => 0, 'y' => 0])->assertStatus(422);
        $this->actingAs($first)->postJson("/games/{$game->id}/fire", ['x' => 0, 'y' => 0])->assertOk()->assertJsonPath('moves.0.result', 'hit');
        $this->actingAs($first)->postJson("/games/{$game->id}/fire", ['x' => 9, 'y' => 9])->assertStatus(422);
        $this->actingAs($second)->postJson("/games/{$game->id}/fire", ['x' => 9, 'y' => 9])->assertOk()->assertJsonPath('moves.1.result', 'miss');

        // Chat privado de la partida.
        $this->actingAs($first)->postJson('/chat', ['game_id' => $game->id, 'body' => '¡Te hundiré!'])->assertOk();
        $this->actingAs($second)->getJson("/games/{$game->id}/state")->assertJsonPath('chat.0.body', '¡Te hundiré!');

        // Un tercero no puede ver ni escribir.
        $carla = $this->siosUser('carla');
        $this->actingAs($carla)->getJson("/games/{$game->id}/state")->assertForbidden();
        $this->actingAs($carla)->postJson('/chat', ['game_id' => $game->id, 'body' => 'hola'])->assertForbidden();

        $this->actingAs($first)->postJson("/games/{$game->id}/forfeit")->assertJsonPath('status', 'finished')
            ->assertJsonPath('finish_reason', 'forfeit');
    }

    public function test_invalid_fleets_are_rejected(): void
    {
        $this->actingAs($this->siosUser('ana'));
        $this->postJson('/games/cpu', ['difficulty' => 'easy']);
        $game = Game::firstOrFail();

        $overlap = $this->fleet();
        $overlap[1]['y'] = 0;
        $this->postJson("/games/{$game->id}/ships", ['ships' => $overlap])->assertStatus(422);

        $outside = $this->fleet();
        $outside[0]['x'] = 7;
        $this->postJson("/games/{$game->id}/ships", ['ships' => $outside])->assertStatus(422);

        $this->postJson("/games/{$game->id}/ships", ['ships' => array_slice($this->fleet(), 0, 4)])->assertStatus(422);
    }

    public function test_lobby_chat(): void
    {
        $ana = $this->siosUser('ana');
        $this->actingAs($ana)->getJson('/lobby/poll')->assertOk();
        $this->actingAs($ana)->postJson('/chat', ['body' => 'Hola a todos'])->assertOk();
        $this->actingAs($this->siosUser('beto'))->getJson('/lobby/poll')
            ->assertJsonPath('chat.0.body', 'Hola a todos')
            ->assertJsonPath('online.0.name', 'Ana Pérez');
    }
}
