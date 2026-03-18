<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class VehicleCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_csv_import_creates_and_updates_rows(): void
    {
        [$user, $merchant] = $this->createUserMerchant();

        Vehicle::create([
            'account_id' => $merchant->account_id,
            'plate_number' => 'CA12345',
            'make' => 'Old',
            'model' => 'Truck',
        ]);

        $csv = <<<CSV
plate_number,make,model,year,is_active,metadata_json
CA12345,Toyota,Hilux,2022,true,"{""source"":""csv""}"
CA54321,Ford,Ranger,2021,false,
CSV;

        $response = $this->actingAs($user)->post('/api/v1/vehicles/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('vehicles.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 2)
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);
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
