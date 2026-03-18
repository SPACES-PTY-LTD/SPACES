<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Driver;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class DriverCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_csv_import_creates_and_updates_rows(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $existingUser = User::withoutEvents(fn () => User::factory()->create([
            'role' => 'driver',
            'account_id' => $merchant->account_id,
            'email' => 'driver1@example.com',
        ]));

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $existingUser->id,
            'is_active' => false,
        ]);

        $csv = <<<CSV
name,email,telephone,is_active,notes,intergration_id
Jane Doe,driver1@example.com,+15550001,true,Updated note,drv-1
John Smith,driver2@example.com,+15550002,true,New driver,drv-2
CSV;

        $response = $this->actingAs($user)->post('/api/v1/drivers/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('drivers.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 2)
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('drivers', [
            'merchant_id' => $merchant->id,
            'intergration_id' => 'drv-1',
        ]);

        $this->assertDatabaseHas('drivers', [
            'merchant_id' => $merchant->id,
            'intergration_id' => 'drv-2',
        ]);
    }

    public function test_driver_store_populates_merchant_id(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        $response = $this->actingAs($user)->postJson('/api/v1/drivers', [
            'merchant_id' => $merchant->uuid,
            'name' => 'Manual Driver',
            'email' => 'manual-driver@example.com',
            'telephone' => '+15550003',
            'password' => 'secret123',
            'is_active' => true,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.merchant_id', $merchant->uuid);

        $this->assertDatabaseHas('drivers', [
            'merchant_id' => $merchant->id,
        ]);
    }

    private function createUserMerchant(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant];
    }
}
