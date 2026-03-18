<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_login_logout(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'telephone' => '123',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $register->assertStatus(201);
        $token = $register->json('data.token');
        $this->assertNotEmpty($token);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password123',
        ]);

        $login->assertStatus(200);
        $token = $login->json('data.token');

        $logout = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $logout->assertStatus(200);
    }
}
