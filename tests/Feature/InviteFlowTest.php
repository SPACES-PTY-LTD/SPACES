<?php

namespace Tests\Feature;

use App\Jobs\SendMerchantInviteEmailJob;
use App\Models\Merchant;
use App\Models\MerchantInvite;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class InviteFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_invite_accept_flow(): void
    {
        Queue::fake();

        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $owner->id]);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);

        $inviteResponse = $this->actingAs($owner)->postJson("/api/v1/merchants/{$merchant->uuid}/members/invite", [
            'email' => 'newuser@example.com',
            'role' => 'developer',
        ]);

        $inviteResponse->assertStatus(201);

        $token = null;
        Queue::assertPushed(SendMerchantInviteEmailJob::class, function ($job) use (&$token) {
            $token = $job->plainToken;
            return true;
        });

        $this->assertNotEmpty($token);

        $acceptResponse = $this->postJson('/api/v1/merchant-invites/accept', [
            'token' => $token,
            'name' => 'New User',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $acceptResponse->assertStatus(200);
        $this->assertNotNull($acceptResponse->json('data.token'));
    }

    public function test_invite_accept_requires_name_and_password_for_new_user(): void
    {
        Queue::fake();

        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $owner->id]);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);

        $this->actingAs($owner)->postJson("/api/v1/merchants/{$merchant->uuid}/members/invite", [
            'email' => 'newuser@example.com',
            'role' => 'developer',
        ])->assertStatus(201);

        $token = null;
        Queue::assertPushed(SendMerchantInviteEmailJob::class, function ($job) use (&$token) {
            $token = $job->plainToken;
            return true;
        });

        $this->postJson('/api/v1/merchant-invites/accept', [
            'token' => $token,
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'NAME_AND_PASSWORD_REQUIRED')
            ->assertJsonPath('error.message', 'Complete your name and password to accept this invite.');
    }

    public function test_invite_accept_returns_expired_error_for_expired_invite(): void
    {
        $owner = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $owner->id]);

        MerchantInvite::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'invited_by_user_id' => $owner->id,
            'email' => 'newuser@example.com',
            'role' => 'developer',
            'token_hash' => hash('sha256', 'expired-token'),
            'expires_at' => now()->subMinute(),
        ]);

        $this->postJson('/api/v1/merchant-invites/accept', [
            'token' => 'expired-token',
            'name' => 'New User',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertStatus(422)
            ->assertJsonPath('error.code', 'INVITE_EXPIRED')
            ->assertJsonPath('error.message', 'This invite has expired. Ask for a new invite link.');
    }
}
