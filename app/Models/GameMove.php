<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class GameMove extends Model
{
    public const UPDATED_AT = null;

    protected $guarded = [];

    public function toClient(): array
    {
        return [
            'id' => $this->id,
            'player' => $this->player,
            'x' => $this->x,
            'y' => $this->y,
            'result' => $this->result,
            'ship' => $this->ship,
        ];
    }
}
