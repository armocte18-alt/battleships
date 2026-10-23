<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('minesweeper_scores', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->index(); // users de SIOS
            $table->string('user_name');
            $table->string('difficulty', 10);
            $table->unsignedInteger('time_ms');
            $table->timestamp('created_at')->nullable();

            $table->index(['difficulty', 'time_ms']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('minesweeper_scores');
    }
};
