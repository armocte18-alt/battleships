<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Puntajes de los juegos nuevos (Asteroides, Serpiente, …)
        Schema::create('arcade_scores', function (Blueprint $table) {
            $table->id();
            $table->string('game', 20);
            $table->string('mode', 20);
            $table->unsignedBigInteger('user_id')->index(); // users de SIOS
            $table->string('user_name');
            $table->unsignedInteger('score');
            $table->unsignedInteger('duration');
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->nullable();

            $table->index(['game', 'mode', 'score']);
        });

        Schema::create('asteroid_rooms', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('host_id');
            $table->string('status', 10)->index(); // waiting | playing | finished
            $table->json('players');
            $table->unsignedInteger('seed');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asteroid_rooms');
        Schema::dropIfExists('arcade_scores');
    }
};
