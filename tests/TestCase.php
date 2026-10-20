<?php

namespace Tests;

use App\Models\SiosUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

abstract class TestCase extends BaseTestCase
{
    /**
     * Simula la tabla users de SIOS en una base SQLite en memoria.
     */
    protected function setUpSios(): void
    {
        Schema::connection('sios')->dropIfExists('users');
        Schema::connection('sios')->create('users', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('username')->unique();
            $t->string('avatar')->nullable();
            $t->string('email')->unique();
            $t->string('password');
            $t->rememberToken();
            $t->timestamps();
        });
    }

    protected function siosUser(string $username, ?string $name = null): SiosUser
    {
        $id = DB::connection('sios')->table('users')->insertGetId([
            'name' => $name ?? ucfirst($username).' Pérez',
            'username' => $username,
            'email' => $username.'@sios.test',
            'password' => Hash::make('secreto'),
        ]);

        return SiosUser::findOrFail($id);
    }
}
