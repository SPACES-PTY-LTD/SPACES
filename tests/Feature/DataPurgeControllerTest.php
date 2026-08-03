<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataPurgeControllerTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_can_purge_vehicle_activity_without_deleting_vehicles(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
        ]);

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'make' => 'Ford',
            'model' => 'Transit',
            'plate_number' => 'CA 123 456',
        ]);

        $otherUser = User::factory()->create();
        $otherAccount = Account::create(['owner_user_id' => $otherUser->id]);
        $otherUser->update(['account_id' => $otherAccount->id]);

        $otherMerchant = Merchant::factory()->create([
            'account_id' => $otherAccount->id,
            'owner_user_id' => $otherUser->id,
        ]);

        $otherVehicle = Vehicle::create([
            'account_id' => $otherAccount->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => 'GP 654 321',
        ]);

        $merchantActivity = VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'event_type' => VehicleActivity::EVENT_MOVING,
            'occurred_at' => now(),
        ]);

        $otherMerchantActivity = VehicleActivity::create([
            'account_id' => $otherAccount->id,
            'merchant_id' => $otherMerchant->id,
            'vehicle_id' => $otherVehicle->id,
            'event_type' => VehicleActivity::EVENT_STOPPED,
            'occurred_at' => now(),
        ]);

        $response = $this->withToken($user->createToken('test-suite')->plainTextToken)
            ->postJson("/api/v1/merchants/{$merchant->uuid}/purge-data", [
                'merchant_id' => $merchant->uuid,
                'password' => 'password',
                'types' => ['vehicle_activity'],
            ]);

        $response->assertOk()
            ->assertJsonPath('data.processed_types.0', 'vehicle_activity')
            ->assertJsonPath('data.results.vehicle_activity.tables.vehicle_activity', 1);

        $this->assertDatabaseMissing('vehicle_activity', ['id' => $merchantActivity->id]);
        $this->assertDatabaseHas('vehicle_activity', ['id' => $otherMerchantActivity->id]);
        $this->assertDatabaseHas('vehicles', ['id' => $vehicle->id]);
    }

    public function test_it_can_purge_unassigned_vehicles_owned_by_the_merchant(): void
    {
        $user = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
        ]);

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'make' => 'Ford',
            'model' => 'Transit',
            'plate_number' => 'CA 123 456',
        ]);

        $otherUser = User::factory()->create();
        $otherAccount = Account::create(['owner_user_id' => $otherUser->id]);
        $otherUser->update(['account_id' => $otherAccount->id]);

        $otherMerchant = Merchant::factory()->create([
            'account_id' => $otherAccount->id,
            'owner_user_id' => $otherUser->id,
        ]);

        $otherVehicle = Vehicle::create([
            'account_id' => $otherAccount->id,
            'merchant_id' => $otherMerchant->id,
            'make' => 'Toyota',
            'model' => 'Hilux',
            'plate_number' => 'GP 654 321',
        ]);

        $response = $this->withToken($user->createToken('test-suite')->plainTextToken)
            ->postJson("/api/v1/merchants/{$merchant->uuid}/purge-data", [
                'merchant_id' => $merchant->uuid,
                'password' => 'password',
                'types' => ['vehicles'],
            ]);

        $response->assertOk()
            ->assertJsonPath('data.processed_types.0', 'vehicles')
            ->assertJsonPath('data.results.vehicles.tables.vehicles', 1);

        $this->assertDatabaseMissing('vehicles', ['id' => $vehicle->id]);
        $this->assertDatabaseHas('vehicles', ['id' => $otherVehicle->id]);
    }
}
