<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChatMessage extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'user_id' => $this->user_id,
            'user' => $this->user_name,
            'body' => $this->body,
            'time' => $this->created_at?->format('H:i'),
        ];
    }
}
