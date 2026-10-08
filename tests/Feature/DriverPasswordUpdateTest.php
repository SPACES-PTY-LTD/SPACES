<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverPasswordUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_reset_a_driver_password_in_the_selected_secondary_merchant(): void
    {
        [$admin, $first, $selected] = $this->createAdminMerchants();
        $driver = $this->createDriver($selected);

        $this->resetPassword($admin, $driver)->assertNotFound();
        $this->resetPassword($admin, $driver, ['merchant_id' => $selected->uuid])
            ->assertOk()->assertJsonPath('data.driver_id', $driver->uuid);

        $this->assertTrue(Hash::check('new-password', $driver->user->fresh()->password));
        $log = ActivityLog::where('entity_uuid', $driver->uuid)->firstOrFail();
        $this->assertSame($selected->id, $log->merchant_id);
        $this->assertSame(['password_updated' => true], $log->metadata);
        $this->assertStringNotContainsString('new-password', $log->toJson());
    }

    public function test_omitting_merchant_context_preserves_first_merchant_behavior(): void
    {
        [$admin, $first] = $this->createAdminMerchants();
        $driver = $this->createDriver($first);

        $this->resetPassword($admin, $driver)->assertOk();
        $this->assertTrue(Hash::check('new-password', $driver->user->fresh()->password));
    }

    public function test_selected_merchant_does_not_allow_resetting_another_merchants_driver(): void
    {
        [$admin, $first, $selected] = $this->createAdminMerchants();
        $driver = $this->createDriver($first);
        $original = $driver->user->password;

        $this->resetPassword($admin, $driver, ['merchant_id' => $selected->uuid])
            ->assertNotFound()->assertJsonPath('error.code', 'NOT_FOUND');
        $this->assertSame($original, $driver->user->fresh()->password);
        $this->assertDatabaseCount('activity_logs', 0);
    }

    public function test_inaccessible_or_unknown_merchant_does_not_fall_back_to_first_merchant(): void
    {
        [$admin, $first] = $this->createAdminMerchants();
        $otherOwner = $this->createUser('user');
        $foreign = Merchant::factory()->create(['owner_user_id' => $otherOwner->id]);
        $localDriver = $this->createDriver($first);
        $foreignDriver = $this->createDriver($foreign);

        foreach ([[$localDriver, $foreign->uuid], [$foreignDriver, $foreign->uuid], [$localDriver, (string) Str::uuid()]] as [$driver, $merchantUuid]) {
            $original = $driver->user->password;
            $this->resetPassword($admin, $driver, ['merchant_id' => $merchantUuid])->assertNotFound();
            $this->assertSame($original, $driver->user->fresh()->password);
        }
        $this->assertDatabaseCount('activity_logs', 0);
    }

    public function test_selected_merchant_supports_legacy_carrier_scoped_drivers(): void
    {
        [$admin, $first, $selected] = $this->createAdminMerchants();
        $driver = $this->createDriver($selected);
        $carrier = Carrier::create(['merchant_id' => $selected->id, 'code' => 'legacy-test', 'name' => 'Legacy carrier', 'type' => 'internal', 'enabled' => true]);
        $driver->update(['merchant_id' => null, 'carrier_id' => $carrier->id]);

        $this->resetPassword($admin, $driver, ['merchant_id' => $selected->uuid])->assertOk();
        $this->assertTrue(Hash::check('new-password', $driver->user->fresh()->password));
        $this->assertDatabaseHas('activity_logs', ['entity_uuid' => $driver->uuid, 'merchant_id' => $selected->id]);
    }

    public function test_super_admin_can_reset_a_driver_password_without_merchant_context(): void
    {
        [$owner, $first] = $this->createAdminMerchants();
        $driver = $this->createDriver($first);
        $admin = $this->createUser('super_admin');

        $this->resetPassword($admin, $driver)->assertOk();
        $this->assertTrue(Hash::check('new-password', $driver->user->fresh()->password));
    }

    public function test_password_confirmation_and_merchant_uuid_are_validated(): void
    {
        [$admin, $first] = $this->createAdminMerchants();
        $driver = $this->createDriver($first);
        $original = $driver->user->password;

        $this->resetPassword($admin, $driver, ['password_confirmation' => 'mismatch'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION');
        $this->resetPassword($admin, $driver, ['merchant_id' => 'invalid'])
            ->assertUnprocessable()->assertJsonPath('error.code', 'VALIDATION');
        $this->assertSame($original, $driver->user->fresh()->password);
    }

    private function createUser(string $role, ?int $accountId = null): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(), 'role' => $role, 'account_id' => $accountId,
        ]));
    }

    private function createAdminMerchants(): array
    {
        $admin = $this->createUser('user');
        $account = Account::create(['owner_user_id' => $admin->id]);
        $admin->update(['account_id' => $account->id]);
        $merchants = [];
        for ($i = 0; $i < 2; $i++) {
            $merchant = Merchant::factory()->create(['owner_user_id' => $admin->id, 'account_id' => $account->id]);
            $merchant->users()->attach($admin->id, ['role' => 'admin']);
            $merchants[] = $merchant;
        }

        return [$admin, ...$merchants];
    }

    private function createDriver(Merchant $merchant): Driver
    {
        $user = $this->createUser('driver', $merchant->account_id);

        return Driver::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);
    }

    private function resetPassword(User $admin, Driver $driver, array $overrides = [])
    {
        return $this->withToken($admin->createToken('test-token')->plainTextToken)
            ->patchJson('/api/v1/drivers/' . $driver->uuid . '/password', array_merge([
                'password' => 'new-password', 'password_confirmation' => 'new-password',
            ], $overrides));
    }
}
