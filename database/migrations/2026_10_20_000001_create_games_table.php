<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('games', function (Blueprint $table) {
            $table->id();
            $table->string('mode', 10);            // pvp | cpu
            $table->string('status', 15)->index(); // invited | placing | playing | finished | declined | cancelled
            $table->string('difficulty', 10)->nullable();

            // Los ids son de la tabla users de SIOS (otra base de datos, sin llave foránea).
            $table->unsignedBigInteger('player1_id')->index();
            $table->string('player1_name');
            $table->unsignedBigInteger('player2_id')->nullable()->index();
            $table->string('player2_name');

            $table->json('board1')->nullable();
            $table->json('board2')->nullable();
            $table->unsignedTinyInteger('turn')->nullable();
            $table->unsignedTinyInteger('winner')->nullable();
            $table->string('finish_reason', 15)->nullable(); // sunk | forfeit | abandon
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('game_moves', function (Blueprint $table) {
            $table->id();
            $table->foreignId('game_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('player');
            $table->unsignedTinyInteger('x');
            $table->unsignedTinyInteger('y');
            $table->string('result', 5); // miss | hit | sunk
            $table->string('ship', 15)->nullable();
            $table->timestamp('created_at')->nullable();

            $table->unique(['game_id', 'player', 'x', 'y']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('game_moves');
        Schema::dropIfExists('games');
    }
};
