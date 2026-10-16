<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_logout_removes_device_registrations_and_rejects_stale_registration(): void
    {
        $user = \App\Models\User::factory()->create(['role' => 'driver']);
        $other = \App\Models\User::factory()->create(['role' => 'driver']);
        $token = $user->createToken('logout-device');
        $service = app(\App\Services\UserDeviceService::class);
        $device = $service->register($user, ['platform' => 'android', 'push_provider' => 'expo', 'push_token' => 'logout-push']);
        $foreign = $service->register($other, ['platform' => 'ios', 'push_provider' => 'expo', 'push_token' => 'other-push']);
        $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken)->postJson('/api/v1/auth/logout')->assertOk();
        $this->assertSoftDeleted('user_devices', ['id' => $device->id]);
        $this->assertNull(\App\Models\UserDevice::withTrashed()->find($device->id)->push_token);
        $this->assertNotNull($foreign->fresh());
        $this->assertSame('other-push', $foreign->fresh()->push_token);
        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->accessToken->id]);
        // Simulate a request authenticated before logout but entering registration afterward.
        $user->withAccessToken($token->accessToken);
        try {
            $service->register($user, ['platform' => 'android', 'push_token' => 'logout-push']);
            $this->fail('Revoked registration was accepted');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertSame(401, $error->getStatusCode());
        }
        $this->assertSame(0, \App\Models\UserDevice::where('user_id', $user->id)->count());
        $user->withAccessToken($user->createToken('new-login')->accessToken);
        $replacement = $service->register($user, ['platform' => 'android', 'push_provider' => 'expo', 'push_token' => 'logout-push']);
        $this->assertNotSame($device->id, $replacement->id);
    }

    public function test_refresh_survives_a_day_of_inactivity_and_rejects_reuse_and_expiry(): void
    {
        $user = \App\Models\User::factory()->create(['role' => 'super_admin']);
        $login = app(\App\Services\AuthService::class)->login([
            'email' => $user->email, 'password' => 'password', 'login_context' => 'admin',
        ]);
        \Illuminate\Support\Facades\Route::get('/_test/authenticated', fn () => response()->json(['ok' => true]))->middleware('auth.api');
        $this->travel(25)->hours();
        $this->withHeader('Authorization', 'Bearer '.$login['token'])
            ->getJson('/_test/authenticated')->assertUnauthorized();
        $refresh = $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['refresh_token']])
            ->assertOk()->assertJsonPath('data.expires_in', 3600);
        $this->assertNotEmpty($refresh->json('data.token'));
        $this->withHeader('Authorization', 'Bearer '.$refresh->json('data.token'))
            ->getJson('/_test/authenticated')->assertOk();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['refresh_token']])->assertUnauthorized();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => 'invalid'])->assertUnauthorized();
        $this->postJson('/api/v1/auth/refresh', [])->assertUnprocessable();
        $this->travel(31)->days();
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $refresh->json('data.refresh_token')])->assertUnauthorized();
    }

    public function test_refresh_failure_rolls_back_rotation_and_can_be_retried(): void
    {
        $user = \App\Models\User::factory()->create();
        $login = app(\App\Services\AuthService::class)->login(['email' => $user->email, 'password' => 'password']);
        $failCreation = true;
        \App\Models\RefreshToken::creating(function () use (&$failCreation) { if ($failCreation) throw new \RuntimeException('Storage unavailable'); });
        try {
            $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['refresh_token']])->assertStatus(503);
            $this->assertDatabaseHas('refresh_tokens', ['token_hash' => hash('sha256', $login['refresh_token']), 'revoked_at' => null]);
        } finally {
            $failCreation = false;
        }
        $this->postJson('/api/v1/auth/refresh', ['refresh_token' => $login['refresh_token']])->assertOk();
    }

    public function test_register_login_logout(): void
    {
        $register = $this->postJson('/api/v1/auth/register', [
            'name' => 'Jane Doe',
            'email' => 'jane@example.com',
            'country_code' => 'ZA',
            'telephone' => '123',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $register->assertStatus(201);
        $token = $register->json('data.token');
        $this->assertNotEmpty($token);
        $this->assertDatabaseHas('accounts', [
            'country_code' => 'ZA',
            'is_billing_exempt' => false,
        ]);

        $login = $this->postJson('/api/v1/auth/login', [
            'email' => 'jane@example.com',
            'password' => 'password123',
        ]);

        $login->assertStatus(200);
        $login->assertJsonPath('data.expires_in', 3600);
        $this->assertNotEmpty($login->json('data.refresh_token'));
        $token = $login->json('data.token');

        $refresh = $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $login->json('data.refresh_token'),
        ]);

        $refresh->assertOk()
            ->assertJsonPath('data.expires_in', 3600);
        $this->assertNotSame($login->json('data.refresh_token'), $refresh->json('data.refresh_token'));

        $this->postJson('/api/v1/auth/refresh', [
            'refresh_token' => $login->json('data.refresh_token'),
        ])->assertUnauthorized();

        $token = $refresh->json('data.token');

        $logout = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/v1/auth/logout');

        $logout->assertStatus(200);
    }
}
