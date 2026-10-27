<?php

namespace Tests\Feature;

use App\Http\Middleware\SessionCookiePath;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Tests\TestCase;

class SecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->setUpSios();
    }

    public function test_security_headers_and_csp_nonce(): void
    {
        $res = $this->get('/login')->assertOk()
            ->assertHeader('X-Frame-Options', 'SAMEORIGIN')
            ->assertHeader('X-Content-Type-Options', 'nosniff');

        $csp = $res->headers->get('Content-Security-Policy');
        $this->assertStringContainsString("object-src 'none'", $csp);
        $this->assertMatchesRegularExpression("/script-src 'self' 'nonce-([A-Za-z0-9]{32})'/", $csp);

        // Todos los <script> en línea llevan el nonce de la respuesta.
        preg_match("/'nonce-([A-Za-z0-9]{32})'/", $csp, $m);
        $html = $this->actingAs($this->siosUser('ana'))->get('/pacman')->getContent();
        $this->assertDoesNotMatchRegularExpression('/<script>(?!\s*<\/script>)/', $html);
        $this->assertStringNotContainsString('onerror=', $html);
    }

    public function test_login_is_rate_limited_per_ip_across_usernames(): void
    {
        for ($i = 0; $i < 20; $i++) {
            $this->post('/login', ['login' => "usuario$i", 'password' => 'x']);
        }
        $this->post('/login', ['login' => 'otro', 'password' => 'x'])->assertSessionHasErrors('login');
        $this->assertStringStartsWith('Demasiados intentos', session('errors')->first('login'));
    }

    public function test_chat_html_is_stored_as_text_and_room_creation_is_throttled(): void
    {
        $this->actingAs($this->siosUser('ana'));
        $this->postJson('/chat', ['body' => '<img src=x onerror=alert(1)>'])->assertOk()
            ->assertJsonPath('body', '<img src=x onerror=alert(1)>'); // se escapa al mostrarse (BS.esc)

        for ($i = 0; $i < 4; $i++) {
            $this->postJson('/asteroides/salas')->assertOk();
        }
        $this->postJson('/asteroides/salas')->assertStatus(429);
    }

    public function test_score_meta_only_keeps_known_keys(): void
    {
        $this->actingAs($this->siosUser('ana'))
            ->postJson('/puntajes/snake', ['mode' => 'classic', 'score' => 50, 'duration' => 30, 'meta' => ['length' => 8, 'hack' => 1]])
            ->assertOk()->assertJsonPath('leaderboard.0.meta', ['length' => 8]);
    }

    public function test_guest_cannot_reach_game_endpoints(): void
    {
        $this->getJson('/lobby/poll')->assertUnauthorized();
        $this->postJson('/puntajes/snake', [])->assertUnauthorized();
        $this->get('/asteroides')->assertRedirect('/login');
    }

    public function test_session_cookie_path_follows_the_folder_the_site_is_opened_from(): void
    {
        foreach (['/battle_ships' => '/battle_ships', '/Battle_Ships' => '/Battle_Ships', '/battle_ships/public' => '/battle_ships/public', '' => '/'] as $base => $expected) {
            $request = Request::create("http://servidor$base/login", 'GET', server: [
                'SCRIPT_NAME' => "$base/index.php",
                'SCRIPT_FILENAME' => '/var/www/index.php',
            ]);
            (new SessionCookiePath)->handle($request, fn () => response('ok'));
            $this->assertSame($expected, config('session.path'), "base $base");
        }
    }
}
