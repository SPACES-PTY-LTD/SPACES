<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Tests\TestCase;

class VehiclesDailyKpiReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_counts_daily_vehicle_kpis_and_includes_inactive_vehicles(): void
    {
        Carbon::setTestNow('2026-07-24 12:00:00');
        [$user, $merchant, $account] = $this->merchantContext('Africa/Johannesburg');
        $vehicle = $this->vehicle($account, $merchant, 'HR123456', false);
        $emptyVehicle = $this->vehicle($account, $merchant, 'HR000000');
        $deletedVehicle = $this->vehicle($account, $merchant, 'DELETED');
        $deletedVehicle->delete();

        $this->activity($account, $merchant, $vehicle, VehicleActivity::EVENT_SPEEDING, '2026-07-02 08:00:00', 81);
        $this->activity($account, $merchant, $vehicle, VehicleActivity::EVENT_SPEEDING, '2026-07-01 22:30:00', 90);
        $this->activity($account, $merchant, $vehicle, VehicleActivity::EVENT_SPEEDING, '2026-07-02 09:00:00', 80);
        $this->activity($account, $merchant, $vehicle, VehicleActivity::EVENT_STOPPED, '2026-07-02 10:00:00');

        $run = Run::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'status' => Run::STATUS_COMPLETED,
            'started_at' => '2026-07-02 11:00:00',
        ]);
        $shipment = Shipment::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'KPI-001',
            'status' => 'delivered',
            'invoiced_at' => '2026-07-03 08:00:00',
        ]);
        $shipment->forceFill(['created_at' => '2026-07-02 12:00:00'])->save();
        RunShipment::create([
            'uuid' => (string) Str::uuid(),
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_DONE,
        ]);

        $response = $this->withToken($user->createToken('test')->plainTextToken)
            ->getJson("/api/v1/reports/vehicles-daily-kpi?merchant_id={$merchant->uuid}&year=2026&month=7");

        $response->assertOk()
            ->assertJsonPath('meta.days_in_month', 31)
            ->assertJsonPath('meta.month_label', 'July 2026')
            ->assertJsonCount(2, 'data');

        $row = collect($response->json('data'))->firstWhere('vehicle_id', $vehicle->uuid);
        $this->assertSame(2, $row['days']['2']['speed_violations']);
        $this->assertSame(1, $row['days']['2']['runs']);
        $this->assertSame(1, $row['days']['2']['shipments']);
        $this->assertSame(1, $row['days']['2']['total_stops']);
        $this->assertSame(1, $row['days']['2']['unknown_location_stops']);
        $this->assertSame(1, $row['days']['3']['invoiced_shipments']);
        $this->assertNotNull(collect($response->json('data'))->firstWhere('vehicle_id', $emptyVehicle->uuid));

        Carbon::setTestNow();
    }

    public function test_report_filters_empty_vehicles_and_rejects_future_months(): void
    {
        Carbon::setTestNow('2026-07-24 12:00:00');
        [$user, $merchant, $account] = $this->merchantContext();
        $withData = $this->vehicle($account, $merchant, 'DATA');
        $this->vehicle($account, $merchant, 'EMPTY');
        $this->activity($account, $merchant, $withData, VehicleActivity::EVENT_STOPPED, '2026-07-10 10:00:00');
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/v1/reports/vehicles-daily-kpi?merchant_id={$merchant->uuid}&year=2026&month=7&only_with_data=true")
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.registration', 'DATA');

        $this->withToken($token)
            ->getJson("/api/v1/reports/vehicles-daily-kpi?merchant_id={$merchant->uuid}&year=2026&month=8")
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR');

        Carbon::setTestNow();
    }

    public function test_report_is_scoped_to_the_authenticated_account(): void
    {
        [$user] = $this->merchantContext();
        [, $otherMerchant] = $this->merchantContext();

        $this->withToken($user->createToken('test')->plainTextToken)
            ->getJson("/api/v1/reports/vehicles-daily-kpi?merchant_id={$otherMerchant->uuid}&year=2026&month=1")
            ->assertNotFound();
    }

    private function merchantContext(string $timezone = 'UTC'): array
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
            'timezone' => $timezone,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant, $account];
    }

    private function vehicle(Account $account, Merchant $merchant, string $plate, bool $active = true): Vehicle
    {
        return Vehicle::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'plate_number' => $plate,
            'is_active' => $active,
        ]);
    }

    private function activity(
        Account $account,
        Merchant $merchant,
        Vehicle $vehicle,
        string $event,
        string $occurredAt,
        ?float $speed = null
    ): VehicleActivity {
        return VehicleActivity::create([
            'uuid' => (string) Str::uuid(),
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'event_type' => $event,
            'occurred_at' => $occurredAt,
            'speed_kph' => $speed,
        ]);
    }
}
