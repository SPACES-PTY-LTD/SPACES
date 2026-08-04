<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleBulkDeleteTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_bulk_delete_selected_vehicles(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $firstVehicle = $this->createVehicle($account, $merchant, 'BULK-001');
        $secondVehicle = $this->createVehicle($account, $merchant, 'BULK-002');
        $untouchedVehicle = $this->createVehicle($account, $merchant, 'BULK-003');

        $response = $this->authenticated($user)->deleteJson('/api/v1/vehicles/bulk', [
            'merchant_id' => $merchant->uuid,
            'vehicle_ids' => [$firstVehicle->uuid, $secondVehicle->uuid],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.deleted_count', 2);

        $this->assertSoftDeleted($firstVehicle);
        $this->assertSoftDeleted($secondVehicle);
        $this->assertNotSoftDeleted($untouchedVehicle);
        $this->assertDatabaseCount('activity_logs', 2);
    }

    public function test_bulk_delete_is_atomic_when_a_vehicle_is_outside_the_selected_merchant(): void
    {
        [$user, $account, $merchant] = $this->createMerchantUser();
        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $selectedVehicle = $this->createVehicle($account, $merchant, 'BULK-004');
        $otherVehicle = $this->createVehicle($account, $otherMerchant, 'BULK-005');

        $response = $this->authenticated($user)->deleteJson('/api/v1/vehicles/bulk', [
            'merchant_id' => $merchant->uuid,
            'vehicle_ids' => [$selectedVehicle->uuid, $otherVehicle->uuid],
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        $this->assertNotSoftDeleted($selectedVehicle);
        $this->assertNotSoftDeleted($otherVehicle);
        $this->assertDatabaseCount('activity_logs', 0);
    }

    private function authenticated(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    private function createMerchantUser(): array
    {
        $user = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $account, $merchant];
    }

    private function createVehicle(Account $account, Merchant $merchant, string $plateNumber): Vehicle
    {
        return Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => $plateNumber,
            'is_active' => true,
        ]);
    }
}
