<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pacman_scores', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index(); // users de SIOS
            $table->string('user_name');
            $table->unsignedInteger('score')->index();
            $table->unsignedSmallInteger('level');
            $table->unsignedInteger('duration'); // segundos
            $table->timestamp('created_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pacman_scores');
    }
};
