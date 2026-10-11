<?php

namespace Tests\Feature;

use App\Http\Middleware\ApiAuthMiddleware;
use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class VehicleActivityTimestampFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_timestamp_bounds_are_inclusive_and_respect_timezone_offsets(): void
    {
        $this->withoutMiddleware(ApiAuthMiddleware::class);
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user', 'uuid' => (string) \Illuminate\Support\Str::uuid()]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $vehicle = Vehicle::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'plate_number' => 'TIME-1', 'is_active' => true]);
        foreach (['2026-10-11 10:59:59', '2026-10-11 11:00:00', '2026-10-12 11:00:00', '2026-10-12 11:00:01'] as $time) {
            VehicleActivity::create([
                'account_id' => $account->id, 'merchant_id' => $merchant->id,
                'vehicle_id' => $vehicle->id, 'event_type' => 'entered_location', 'occurred_at' => $time,
            ]);
        }
        $url = '/api/v1/vehicle-activities?'.http_build_query([
            'merchant_id' => $merchant->uuid,
            'occurred_from' => '2026-10-11T13:00:00+02:00',
            'occurred_to' => '2026-10-12T13:00:00+02:00',
        ]);
        $this->actingAs($user)->getJson($url)->assertOk()->assertJsonCount(2, 'data')->assertJsonPath('meta.total', 2);
        // Existing custom date bounds still include the whole selected date.
        $this->getJson('/api/v1/vehicle-activities?'.http_build_query([
            'merchant_id' => $merchant->uuid, 'from' => '2026-10-11', 'to' => '2026-10-11',
        ]))->assertOk()->assertJsonCount(2, 'data');
        $this->getJson('/api/v1/vehicle-activities?occurred_from=invalid')->assertStatus(422);
    }
}
