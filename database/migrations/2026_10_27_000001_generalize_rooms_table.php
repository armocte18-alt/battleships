<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Las salas en tiempo real dejan de ser exclusivas de Asteroides:
 * ahora también las usa Ping Pong (columna "game").
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::rename('asteroid_rooms', 'arcade_rooms');
        Schema::table('arcade_rooms', function (Blueprint $table) {
            $table->string('game', 20)->default('asteroids')->after('id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('arcade_rooms', function (Blueprint $table) {
            $table->dropIndex(['game']);
            $table->dropColumn('game');
        });
        Schema::rename('arcade_rooms', 'asteroid_rooms');
    }
};
