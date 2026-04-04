<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    private function authenticated(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    public function test_merchant_user_only_sees_activity_logs_for_requested_merchant(): void
    {
        $user = User::factory()->create();
        $visibleMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);
        $hiddenMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);

        $visibleMerchant->users()->attach($user->id, ['role' => 'owner']);
        $hiddenMerchant->users()->attach($user->id, ['role' => 'owner']);

        $user->forceFill([
            'last_accessed_merchant_id' => $visibleMerchant->id,
        ])->save();

        $visibleActivity = ActivityLog::query()->create([
            'account_id' => $user->account_id,
            'merchant_id' => $visibleMerchant->id,
            'actor_user_id' => $user->id,
            'action' => 'created',
            'entity_type' => 'shipment',
            'entity_uuid' => (string) \Illuminate\Support\Str::uuid(),
            'title' => 'Visible merchant activity',
            'request_id' => 'req-visible',
            'occurred_at' => now(),
        ]);

        ActivityLog::query()->create([
            'account_id' => $user->account_id,
            'merchant_id' => $hiddenMerchant->id,
            'actor_user_id' => $user->id,
            'action' => 'updated',
            'entity_type' => 'shipment',
            'entity_uuid' => (string) \Illuminate\Support\Str::uuid(),
            'title' => 'Hidden merchant activity',
            'request_id' => 'req-hidden',
            'occurred_at' => now()->subMinute(),
        ]);

        $response = $this->authenticated($user)->getJson('/api/v1/activity-logs?merchant_id='.$visibleMerchant->uuid);

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.activity_id', $visibleActivity->uuid)
            ->assertJsonPath('data.0.merchant_id', $visibleMerchant->uuid);
    }

    public function test_merchant_user_must_supply_merchant_id_to_list_activity_logs(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);

        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->authenticated($user)->getJson('/api/v1/activity-logs');

        $response->assertStatus(422)
            ->assertJsonPath('error.message', 'The merchant_id field is required for this request.');
    }
}
