<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            // null = chat general del puerto (lobby)
            $table->foreignId('game_id')->nullable()->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('user_id');
            $table->string('user_name');
            $table->string('body', 500);
            $table->timestamp('created_at')->nullable();

            $table->index(['game_id', 'id']);
        });

        Schema::create('presences', function (Blueprint $table) {
            $table->unsignedBigInteger('user_id')->primary();
            $table->string('name');
            $table->string('avatar')->nullable();
            $table->unsignedBigInteger('game_id')->nullable();
            $table->timestamp('last_seen_at')->index();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('presences');
        Schema::dropIfExists('chat_messages');
    }
};
