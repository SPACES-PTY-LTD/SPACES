<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class LastAccessedMerchantTest extends TestCase
{
    use RefreshDatabase;

    private function authenticated(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    public function test_users_table_has_last_accessed_merchant_column(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'last_accessed_merchant_id'));
    }

    public function test_users_table_has_profile_photo_path_column(): void
    {
        $this->assertTrue(Schema::hasColumn('users', 'profile_photo_path'));
    }

    public function test_regular_user_can_persist_last_accessed_merchant(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $user->account_id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->authenticated($user)->patchJson('/api/v1/me/last-accessed-merchant', [
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

        $response = $this->authenticated($user)->patchJson('/api/v1/me/last-accessed-merchant', [
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

        $response = $this->authenticated($user)->patchJson('/api/v1/me/last-accessed-merchant', [
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

        $merchant->forceDelete();
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

        $response = $this->authenticated($user)->getJson('/api/v1/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.last_accessed_merchant_id', $merchant->uuid);
    }

    public function test_me_profile_exposes_account_country_for_account_holder(): void
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'owner_user_id' => $user->id,
            'country_code' => 'ZA',
            'is_billing_exempt' => false,
        ]);
        $user->forceFill(['account_id' => $account->id])->save();

        $response = $this->authenticated($user)->getJson('/api/v1/me');

        $response->assertStatus(200)
            ->assertJsonPath('data.is_account_holder', true)
            ->assertJsonPath('data.account_country_code', 'ZA');
    }

    public function test_user_can_upload_profile_photo_from_me_endpoint(): void
    {
        Storage::fake('s3');

        $user = User::factory()->create();

        $response = $this->authenticated($user)->post('/api/v1/me/profile-photo', [
            'photo' => UploadedFile::fake()->image('profile.jpg'),
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.user_id', $user->uuid);

        $user->refresh();

        $this->assertNotNull($user->profile_photo_path);
        $this->assertStringStartsWith('profile-photos/'.$user->uuid.'/', $user->profile_photo_path);
        Storage::disk('s3')->assertExists($user->profile_photo_path);
        $response->assertJsonPath('data.profile_photo_url', Storage::disk('s3')->url($user->profile_photo_path));
    }

    public function test_account_holder_can_update_account_country_from_me_profile(): void
    {
        $user = User::factory()->create();
        $account = Account::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'owner_user_id' => $user->id,
            'country_code' => 'ZA',
            'is_billing_exempt' => false,
        ]);
        $user->forceFill(['account_id' => $account->id])->save();

        $response = $this->authenticated($user)->patchJson('/api/v1/me', [
            'account_country_code' => 'US',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.account_country_code', 'US');

        $this->assertDatabaseHas('accounts', [
            'id' => $account->id,
            'country_code' => 'US',
        ]);
    }

    public function test_non_account_holder_cannot_change_account_country_from_me_profile(): void
    {
        $owner = User::factory()->create();
        $member = User::factory()->create();
        $account = Account::query()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'owner_user_id' => $owner->id,
            'country_code' => 'ZA',
            'is_billing_exempt' => false,
        ]);
        $owner->forceFill(['account_id' => $account->id])->save();
        $member->forceFill(['account_id' => $account->id])->save();

        $response = $this->authenticated($member)->patchJson('/api/v1/me', [
            'account_country_code' => 'US',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('data.is_account_holder', false)
            ->assertJsonPath('data.account_country_code', 'ZA');

        $this->assertDatabaseHas('accounts', [
            'id' => $account->id,
            'country_code' => 'ZA',
        ]);
    }
}
