<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatController;
use App\Http\Controllers\GameController;
use App\Http\Controllers\LobbyController;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
});

Route::middleware('auth')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout'])->name('logout');

    Route::get('/', [LobbyController::class, 'index'])->name('lobby');
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
