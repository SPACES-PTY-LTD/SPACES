<?php

namespace Tests\Feature;

use App\Jobs\SendMerchantInviteEmailJob;
use App\Models\Merchant;
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
}
