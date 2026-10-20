<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\Game;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class ChatController extends Controller
{
    public function store(Request $request)
    {
        $data = $request->validate([
            'game_id' => ['nullable', 'integer'],
            'body' => ['required', 'string', 'max:500'],
        ]);

        $user = $request->user();
        if (! empty($data['game_id'])) {
            $game = Game::findOrFail($data['game_id']);
            abort_if($game->slotOf((int) $user->getKey()) === null, 403);
        }

        $key = 'chat:'.$user->getKey();
        if (RateLimiter::tooManyAttempts($key, 8)) {
            throw ValidationException::withMessages(['body' => 'Vas muy rápido, espera un momento.']);
        }
        RateLimiter::hit($key, 10);

        $message = ChatMessage::create([
            'game_id' => $data['game_id'] ?? null,
            'user_id' => $user->getKey(),
            'user_name' => $user->name,
            'body' => trim($data['body']),
            'created_at' => now(),
        ]);

        return response()->json($message->toClient());
    }
}
