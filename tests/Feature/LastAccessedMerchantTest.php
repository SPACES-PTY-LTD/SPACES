<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LastAccessedMerchantTest extends TestCase
{
    use RefreshDatabase;

    public function test_users_table_has_last_accessed_merchant_column(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'last_accessed_merchant_id'));
    }

    public function test_regular_user_can_persist_last_accessed_merchant(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->actingAs($user)->patchJson('/api/v1/me/last-accessed-merchant', [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.last_accessed_merchant_id', $merchant->uuid);

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'last_accessed_merchant_id' => $merchant->id,
        ]);
    }

    public function test_user_cannot_persist_inaccessible_merchant(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create();

        $response = $this->actingAs($user)->patchJson('/api/v1/me/last-accessed-merchant', [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('error.message', 'You are not authorized to access this merchant.');

        $this->assertDatabaseMissing('users', [
            'id' => $user->id,
            'last_accessed_merchant_id' => $merchant->id,
        ]);
    }

    public function test_super_admin_cannot_persist_last_accessed_merchant(): void
    {
        $user = User::factory()->create(['role' => 'super_admin']);
        $merchant = Merchant::factory()->create();

        $response = $this->actingAs($user)->patchJson('/api/v1/me/last-accessed-merchant', [
            'merchant_id' => $merchant->uuid,
        ]);

        $response->assertStatus(403)
            ->assertJsonPath('error.message', 'Only merchant users can save a last accessed merchant.');
    }

    public function test_last_accessed_merchant_is_nulled_when_merchant_is_deleted(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $user->forceFill([
            'last_accessed_merchant_id' => $merchant->id,
        ])->save();

        $merchant->delete();
        $user->refresh();

        $this->assertNull($user->last_accessed_merchant_id);
    }

    public function test_me_profile_exposes_last_accessed_merchant_uuid(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $user->forceFill([
            'last_accessed_merchant_id' => $merchant->id,
        ])->save();

        $response = $this->actingAs($user)->getJson('/api/v1/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.last_accessed_merchant_id', $merchant->uuid);
    }
}
