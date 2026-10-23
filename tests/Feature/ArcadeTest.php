<?php

namespace Tests\Feature;

use App\Models\PacmanScore;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ArcadeTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSios();
    }

    public function test_hub_lists_games_and_links_to_them(): void
    {
        $this->actingAs($this->siosUser('ana'))->get('/')
            ->assertOk()
            ->assertSee('Battleships')->assertSee('Pac-Man')->assertSee('Próximamente')
            ->assertSee(route('lobby'))->assertSee(route('pacman'));

        $this->get('/battleships')->assertOk();
        $this->get('/pacman')->assertOk()->assertSee('pac-canvas');
    }

    public function test_pacman_scores_and_leaderboard(): void
    {
        $ana = $this->siosUser('ana');
        $beto = $this->siosUser('beto');

        $this->actingAs($ana)->postJson('/pacman/scores', ['score' => 3200, 'level' => 1, 'duration' => 90])
            ->assertOk()->assertJsonPath('new_best', true)->assertJsonPath('rank', 1);
        $this->actingAs($ana)->postJson('/pacman/scores', ['score' => 1500, 'level' => 1, 'duration' => 60])
            ->assertOk()->assertJsonPath('new_best', false)->assertJsonPath('best', 3200);
        $this->actingAs($beto)->postJson('/pacman/scores', ['score' => 9000, 'level' => 2, 'duration' => 200])
            ->assertOk()->assertJsonPath('rank', 1)
            ->assertJsonPath('leaderboard.0.name', 'Beto Pérez')
            ->assertJsonPath('leaderboard.1.score', 3200)
            ->assertJsonCount(2, 'leaderboard');

        // Puntajes imposibles se rechazan.
        $this->postJson('/pacman/scores', ['score' => 500000, 'level' => 1, 'duration' => 60])->assertStatus(422);
        $this->postJson('/pacman/scores', ['score' => 60000, 'level' => 5, 'duration' => 10])->assertStatus(422);

        $this->assertSame(3, PacmanScore::count());
        $this->actingAs($ana)->get('/')->assertSee('9,000');
    }
}
