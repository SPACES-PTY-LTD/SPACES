<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Tests\TestCase;

class VehicleCsvImportTest extends TestCase
{
    use RefreshDatabase;

    public function test_vehicle_csv_import_creates_and_updates_rows(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        $carType = $this->createVehicleType('car', 'Car');
        $trailerType = $this->createVehicleType('trailer', 'Trailer');

        Vehicle::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_type_id' => $trailerType->id,
            'plate_number' => 'CA12345',
            'make' => 'Old',
            'model' => 'Truck',
        ]);

        $csv = <<<CSV
plate_number,vehicle_type,make,model,year,is_active,metadata_json
CA12345,car,Toyota,Hilux,2022,true,"{""source"":""csv""}"
CA54321,Trailer,Ford,Ranger,2021,false,
CSV;

        $response = $this->withAuthToken($user)->post('/api/v1/vehicles/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('vehicles.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 2)
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 1)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('vehicles', [
            'merchant_id' => $merchant->id,
            'plate_number' => 'CA12345',
            'make' => 'Toyota',
            'model' => 'Hilux',
            'vehicle_type_id' => $carType->id,
        ]);

        $this->assertDatabaseHas('vehicles', [
            'merchant_id' => $merchant->id,
            'plate_number' => 'CA54321',
            'make' => 'Ford',
            'model' => 'Ranger',
            'vehicle_type_id' => $trailerType->id,
            'is_active' => false,
        ]);
    }

    public function test_vehicle_csv_import_accepts_legacy_vehicle_type_uuid_header(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        $motorcycleType = $this->createVehicleType('motorcycle', 'Motorcycle');

        $csv = <<<CSV
plate_number,vehicle_type_id,make,model
CA88888,{$motorcycleType->uuid},Yamaha,AG200
CSV;

        $response = $this->withAuthToken($user)->post('/api/v1/vehicles/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('vehicles.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 1)
            ->assertJsonPath('data.created', 1)
            ->assertJsonPath('data.updated', 0)
            ->assertJsonPath('data.failed', 0);

        $this->assertDatabaseHas('vehicles', [
            'merchant_id' => $merchant->id,
            'plate_number' => 'CA88888',
            'vehicle_type_id' => $motorcycleType->id,
        ]);
    }

    public function test_vehicle_csv_import_uses_matching_precedence_and_reports_invalid_vehicle_type(): void
    {
        [$user, $merchant] = $this->createUserMerchant();
        $carType = $this->createVehicleType('car', 'Car');

        $existingByIntegrationId = Vehicle::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_type_id' => $carType->id,
            'intergration_id' => 'existing-int',
            'plate_number' => 'OLD111',
            'ref_code' => 'REF-OLD-1',
            'make' => 'Old',
            'model' => 'One',
        ]);

        $existingByPlate = Vehicle::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_type_id' => $carType->id,
            'plate_number' => 'PLATE222',
            'ref_code' => 'REF-OLD-2',
            'make' => 'Old',
            'model' => 'Two',
        ]);

        $existingByRefCode = Vehicle::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_type_id' => $carType->id,
            'ref_code' => 'REF333',
            'make' => 'Old',
            'model' => 'Three',
        ]);

        $csv = <<<CSV
intergration_id,plate_number,ref_code,vehicle_type,make,model
existing-int,SHOULD-NOT-MATCH-PLATE,SHOULD-NOT-MATCH-REF,car,New,Integration
,PLATE222,IGNORED-REF,car,New,Plate
,,REF333,car,New,Ref
NEW444,,BADREF,spaceship,New,InvalidType
CSV;

        $response = $this->withAuthToken($user)->post('/api/v1/vehicles/import', [
            'merchant_id' => $merchant->uuid,
            'file' => UploadedFile::fake()->createWithContent('vehicles.csv', $csv),
        ]);

        $response->assertOk()
            ->assertJsonPath('data.processed', 4)
            ->assertJsonPath('data.created', 0)
            ->assertJsonPath('data.updated', 3)
            ->assertJsonPath('data.failed', 1)
            ->assertJsonPath('data.errors.0.line', 5);

        $this->assertDatabaseHas('vehicles', [
            'id' => $existingByIntegrationId->id,
            'make' => 'New',
            'model' => 'Integration',
            'plate_number' => 'SHOULD-NOT-MATCH-PLATE',
            'ref_code' => 'SHOULD-NOT-MATCH-REF',
        ]);

        $this->assertDatabaseHas('vehicles', [
            'id' => $existingByPlate->id,
            'make' => 'New',
            'model' => 'Plate',
            'plate_number' => 'PLATE222',
            'ref_code' => 'IGNORED-REF',
        ]);

        $this->assertDatabaseHas('vehicles', [
            'id' => $existingByRefCode->id,
            'make' => 'New',
            'model' => 'Ref',
            'ref_code' => 'REF333',
        ]);

        $this->assertSame(3, Vehicle::query()->where('merchant_id', $merchant->id)->count());
    }

    private function createUserMerchant(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'user',
        ]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant];
    }

    private function createVehicleType(string $code, string $name): VehicleType
    {
        return VehicleType::create([
            'code' => $code,
            'name' => $name,
            'enabled' => true,
        ]);
    }

    private function withAuthToken(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer ' . $user->createToken('test-suite')->plainTextToken);
    }
}
