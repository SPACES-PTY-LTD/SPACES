<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\VehicleService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class VehicleServiceTest extends TestCase
{
    use RefreshDatabase;

    public function test_update_vehicle_sets_location_updated_at_when_last_location_address_changes(): void
    {
        Carbon::setTestNow('2026-02-16 12:00:00');

        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA12345',
            'last_location_address' => ['address_line_1' => 'Old Address'],
            'location_updated_at' => null,
        ]);

        $updated = app(VehicleService::class)->updateVehicle($user, $vehicle->uuid, [
            'last_location_address' => ['address_line_1' => 'New Address'],
        ]);

        $this->assertSame('New Address', $updated->last_location_address['address_line_1']);
        $this->assertSame('2026-02-16T12:00:00+00:00', $updated->location_updated_at?->toIso8601String());

        Carbon::setTestNow();
    }

    public function test_update_vehicle_keeps_explicit_location_updated_at_when_provided(): void
    {
        Carbon::setTestNow('2026-02-16 12:00:00');

        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->account_id = $account->id;
        $user->save();

        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA54321',
            'last_location_address' => ['address_line_1' => 'Old Address'],
            'location_updated_at' => null,
        ]);

        $updated = app(VehicleService::class)->updateVehicle($user, $vehicle->uuid, [
            'last_location_address' => ['address_line_1' => 'New Address'],
            'location_updated_at' => '2026-02-10 08:30:00',
        ]);

        $this->assertSame('New Address', $updated->last_location_address['address_line_1']);
        $this->assertSame('2026-02-10T08:30:00+00:00', $updated->location_updated_at?->toIso8601String());

        Carbon::setTestNow();
    }
}
