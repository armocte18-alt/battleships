<?php

use App\Http\Controllers\ArcadeScoreController;
use App\Http\Controllers\AsteroidsController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\HubController;
use App\Http\Controllers\LobbyController;
use App\Http\Controllers\MinesweeperController;
use App\Http\Controllers\PacmanController;
use App\Http\Controllers\SnakeController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    // Sala de juegos
    Route::get('/', [HubController::class, 'index'])->name('hub');

    // Pac-Man
    Route::get('/pacman', [PacmanController::class, 'index'])->name('pacman');
    Route::post('/pacman/scores', [PacmanController::class, 'store'])->name('pacman.scores');

    // Buscaminas
    Route::get('/buscaminas', [MinesweeperController::class, 'index'])->name('minesweeper');
    Route::post('/buscaminas/scores', [MinesweeperController::class, 'store'])->name('minesweeper.scores');

    // Asteroides (solo o salas de hasta 3 jugadores)
    Route::get('/asteroides', [AsteroidsController::class, 'index'])->name('asteroids');
    Route::get('/asteroides/salas', [AsteroidsController::class, 'rooms'])->name('asteroids.rooms');
    Route::post('/asteroides/salas', [AsteroidsController::class, 'create'])->name('asteroids.create');
    Route::get('/asteroides/salas/{room}', [AsteroidsController::class, 'show'])->name('asteroids.show');
    Route::post('/asteroides/salas/{room}/unirse', [AsteroidsController::class, 'join'])->name('asteroids.join');
    Route::post('/asteroides/salas/{room}/salir', [AsteroidsController::class, 'leave'])->name('asteroids.leave');
    Route::post('/asteroides/salas/{room}/iniciar', [AsteroidsController::class, 'start'])->name('asteroids.start');
    Route::post('/asteroides/salas/{room}/terminar', [AsteroidsController::class, 'finish'])->name('asteroids.finish');
    Route::post('/asteroides/salas/{room}/sync', [AsteroidsController::class, 'sync'])->name('asteroids.sync');

    // Serpiente
    Route::get('/serpiente', [SnakeController::class, 'index'])->name('snake');

    // Puntajes genéricos (Asteroides, Serpiente)
    Route::post('/puntajes/{game}', [ArcadeScoreController::class, 'store'])->name('arcade.scores');

    // Battleships
    Route::get('/battleships', [LobbyController::class, 'index'])->name('lobby');
    Route::get('/lobby/poll', [LobbyController::class, 'poll'])->name('lobby.poll');

    Route::post('/chat', [ChatController::class, 'store'])->name('chat.store');

    Route::post('/games/cpu', [GameController::class, 'createCpu'])->name('games.cpu');
    Route::post('/games/invite', [GameController::class, 'invite'])->name('games.invite');
    Route::get('/games/{game}', [GameController::class, 'show'])->name('games.show');
    Route::get('/games/{game}/state', [GameController::class, 'state'])->name('games.state');
    Route::post('/games/{game}/accept', [GameController::class, 'accept'])->name('games.accept');
    Route::post('/games/{game}/decline', [GameController::class, 'decline'])->name('games.decline');
    Route::post('/games/{game}/ships', [GameController::class, 'ships'])->name('games.ships');
    Route::post('/games/{game}/fire', [GameController::class, 'fire'])->name('games.fire');
    Route::post('/games/{game}/forfeit', [GameController::class, 'forfeit'])->name('games.forfeit');
    Route::post('/games/{game}/claim', [GameController::class, 'claim'])->name('games.claim');
    Route::post('/games/{game}/rematch', [GameController::class, 'rematch'])->name('games.rematch');
});
