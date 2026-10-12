<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\DriverVehicle;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\RunReadinessService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AdminScheduleTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $owner = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id, 'timezone' => 'Africa/Johannesburg']);
        $merchant->users()->attach($owner->id, ['role' => 'owner']);
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $account->id]);
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);
        $vehicle = Vehicle::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'plate_number' => 'SCHEDULE-1', 'is_active' => true]);
        $origin = Location::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'name' => 'Depot', 'address_line_1' => '1 Main', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000']);
        $end = Location::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'name' => 'Mine', 'address_line_1' => '2 Main', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000']);
        $headers = ['Authorization' => 'Bearer '.$owner->createToken('schedule')->plainTextToken, 'X-Merchant-Id' => $merchant->uuid];

        return compact('owner', 'merchant', 'driver', 'user', 'vehicle', 'origin', 'end', 'headers');
    }

    private function shipment(array $c, string $status = 'draft'): Shipment
    {
        return Shipment::create(['account_id' => $c['merchant']->account_id, 'merchant_id' => $c['merchant']->id, 'merchant_order_ref' => (string) Str::uuid(), 'status' => $status,
            'pickup_location_id' => $c['origin']->id, 'dropoff_location_id' => $c['end']->id]);
    }

    private function payload(array $c, string $time, ?Shipment $shipment = null): array
    {
        return ['merchant_id' => $c['merchant']->uuid, 'vehicle_id' => $c['vehicle']->uuid, 'driver_id' => $c['driver']->uuid,
            'schedule_managed' => true, 'schedule_request_id' => (string) Str::uuid(), 'origin_location_id' => $c['origin']->uuid,
            'destination_location_id' => $c['end']->uuid, 'planned_start_at' => $time, 'shipment_ids' => $shipment ? [$shipment->uuid] : []];
    }

    private function create(array $c, array $payload): Run
    {
        $uuid = $this->postJson('/api/v1/runs', $payload, $c['headers'])->assertCreated()->json('data.run_id');

        return Run::where('uuid', $uuid)->firstOrFail();
    }

    private function transfer(array $c, Shipment $shipment, ?Run $source, ?Run $target): array
    {
        return ['merchant_id' => $c['merchant']->uuid, 'shipment_id' => $shipment->uuid, 'expected_source_run_id' => $source?->uuid, 'target_run_id' => $target?->uuid];
    }

    public function test_future_plans_are_not_current_or_startable_and_do_not_assign_permanent_vehicle(): void
    {
        $c = $this->context();
        $shipment = $this->shipment($c);
        $run = $this->create($c, $this->payload($c, now()->addDays(2)->toIso8601String(), $shipment));
        $this->assertSame('draft', $run->status);
        $this->assertFalse(DriverVehicle::where('driver_id', $c['driver']->id)->exists());
        $this->postJson("/api/v1/runs/{$run->uuid}/start", [], $c['headers'])->assertConflict();
        $this->postJson("/api/v1/runs/{$run->uuid}/dispatch", [], $c['headers'])->assertConflict();
        $driverHeaders = ['Authorization' => 'Bearer '.$c['user']->createToken('driver')->plainTextToken];
        $this->getJson('/api/v1/driver/dashboard', $driverHeaders)->assertOk()->assertJsonPath('data.current_run', null)->assertJsonPath('data.remaining', 0);
        $this->postJson("/api/v1/driver/runs/{$run->uuid}/start", [], $driverHeaders)->assertNotFound();
        $this->assertFalse(Run::where('id', $run->id)->where(fn ($q) => RunReadinessService::operational($q))->exists());
    }

    public function test_midnight_readiness_uses_merchant_timezone_and_earliest_run_then_advances_after_closure(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 11)->setTime(21, 59)); // 23:59 merchant time.
        $c = $this->context();
        $firstShipment = $this->shipment($c);
        $first = $this->create($c, $this->payload($c, '2026-10-12T08:00:00+02:00', $firstShipment));
        $second = $this->create($c, $this->payload($c, '2026-10-12T12:00:00+02:00', $this->shipment($c)));
        $this->assertSame('draft', $first->status);
        $this->travelTo(now()->addMinute());
        app(RunReadinessService::class)->reconcile($c['merchant']->id);
        $this->assertSame('dispatched', $first->fresh()->status);
        $this->assertSame('draft', $second->fresh()->status);
        $this->assertTrue(DriverVehicle::where('driver_id', $c['driver']->id)->where('vehicle_id', $c['vehicle']->id)->exists());
        $this->postJson("/api/v1/runs/{$first->uuid}/start", [], $c['headers'])->assertOk();
        $firstShipment->update(['status' => 'delivered']);
        $this->postJson("/api/v1/runs/{$first->uuid}/complete", [], $c['headers'])->assertOk();
        app(RunReadinessService::class)->reconcile($c['merchant']->id);
        $this->assertSame('dispatched', $second->fresh()->status);
    }

    public function test_empty_draft_can_be_saved_and_becomes_ready_only_when_complete(): void
    {
        $c = $this->context();
        $run = $this->create($c, $this->payload($c, now()->toIso8601String()));
        $this->assertSame('draft', $run->status);
        $shipment = $this->shipment($c);
        $this->postJson("/api/v1/runs/{$run->uuid}/shipments", ['shipment_ids' => [$shipment->uuid]], $c['headers'])->assertOk()->assertJsonPath('data.status', 'dispatched');
        $this->patchJson("/api/v1/runs/{$run->uuid}", ['driver_id' => null], $c['headers'])->assertOk()->assertJsonPath('data.status', 'draft');
    }

    public function test_creation_is_retry_safe_and_rejects_changed_payload_for_same_key(): void
    {
        $c = $this->context();
        $payload = $this->payload($c, now()->addDay()->toIso8601String(), $this->shipment($c));
        $first = $this->create($c, $payload);
        $this->postJson('/api/v1/runs', $payload, $c['headers'])->assertCreated()->assertJsonPath('data.run_id', $first->uuid);
        $this->assertSame(1, Run::where('schedule_managed', true)->count());
        $payload['notes'] = 'Changed';
        $this->postJson('/api/v1/runs', $payload, $c['headers'])->assertConflict();
    }

    public function test_atomic_moves_unassignment_and_stale_source_rejection(): void
    {
        $c = $this->context();
        $shipment = $this->shipment($c);
        $source = $this->create($c, $this->payload($c, now()->addDay()->toIso8601String(), $shipment));
        $target = $this->create($c, $this->payload($c, now()->addDays(2)->toIso8601String()));
        $payload = $this->transfer($c, $shipment, $source, $target);
        $this->postJson('/api/v1/schedule/transfer', $payload, $c['headers'])->assertOk();
        $this->postJson('/api/v1/schedule/transfer', $payload, $c['headers'])->assertOk();
        $this->assertDatabaseHas('run_shipments', ['run_id' => $source->id, 'shipment_id' => $shipment->id, 'status' => 'removed']);
        $this->postJson('/api/v1/schedule/transfer', $this->transfer($c, $shipment, $source, null), $c['headers'])->assertConflict();
        $this->postJson('/api/v1/schedule/transfer', $this->transfer($c, $shipment, $target, null), $c['headers'])->assertOk();
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid, $c['headers'])->assertOk()->assertJsonPath('data.shipments.0.shipment_id', $shipment->uuid);
    }

    public function test_closed_target_and_active_source_cannot_lose_the_original_assignment(): void
    {
        $c = $this->context();
        $shipment = $this->shipment($c);
        $source = $this->create($c, $this->payload($c, now()->toIso8601String(), $shipment));
        $target = $this->create($c, $this->payload($c, now()->addDays(2)->toIso8601String()));
        $target->update(['status' => 'cancelled']);
        $this->postJson('/api/v1/schedule/transfer', $this->transfer($c, $shipment, $source, $target), $c['headers'])->assertConflict();
        $this->postJson("/api/v1/runs/{$source->uuid}/start", [], $c['headers'])->assertOk();
        $this->postJson('/api/v1/schedule/transfer', $this->transfer($c, $shipment, $source, null), $c['headers'])->assertConflict();
        $this->assertDatabaseHas('run_shipments', ['run_id' => $source->id, 'shipment_id' => $shipment->id, 'status' => 'active']);
        $this->patchJson("/api/v1/runs/{$source->uuid}", ['driver_id' => null], $c['headers'])->assertConflict();
        $this->postJson('/api/v1/schedule/transfer', $this->transfer($c, $this->shipment($c), null, $source), $c['headers'])->assertOk();
    }

    public function test_new_run_move_is_atomic_and_retry_safe(): void
    {
        $c = $this->context();
        $shipment = $this->shipment($c);
        $source = $this->create($c, $this->payload($c, now()->addDay()->toIso8601String(), $shipment));
        $payload = $this->payload($c, now()->addDays(2)->toIso8601String(), $shipment) + ['expected_source_run_id' => $source->uuid];
        $id = $this->postJson('/api/v1/schedule/runs', $payload, $c['headers'])->assertCreated()->json('data.run_id');
        $this->postJson('/api/v1/schedule/runs', $payload, $c['headers'])->assertCreated()->assertJsonPath('data.run_id', $id);
        $this->assertDatabaseHas('run_shipments', ['run_id' => $source->id, 'shipment_id' => $shipment->id, 'status' => 'removed']);
    }

    public function test_board_groups_multiple_runs_and_keeps_active_and_overdue_outside_selected_dates(): void
    {
        $c = $this->context();
        $active = $this->create($c, $this->payload($c, now()->subDays(3)->toIso8601String(), $this->shipment($c)));
        $this->postJson("/api/v1/runs/{$active->uuid}/start", [], $c['headers'])->assertOk();
        $overdue = $this->create($c, $this->payload($c, now()->subDay()->toIso8601String(), $this->shipment($c)));
        $planned = $this->create($c, $this->payload($c, now()->addDays(2)->toIso8601String(), $this->shipment($c)));
        $terminal = $this->shipment($c, 'delivered');
        $unassigned = $this->shipment($c);
        $day = now('Africa/Johannesburg')->addDays(2)->toDateString();
        $response = $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&from='.$day.'&to='.$day, $c['headers'])->assertOk()
            ->assertJsonCount(3, 'data.trucks.0.runs')->assertJsonCount(1, 'data.shipments')->assertJsonPath('data.shipments.0.shipment_id', $unassigned->uuid);
        $legacy = Run::create(['account_id' => $c['merchant']->account_id, 'merchant_id' => $c['merchant']->id, 'driver_id' => $c['driver']->id, 'status' => 'draft']);
        $driverHeaders = ['Authorization' => 'Bearer '.$c['user']->createToken('driver-current')->plainTextToken];
        $this->getJson("/api/v1/driver/dashboard?run_id={$legacy->uuid}", $driverHeaders)->assertOk()->assertJsonPath('data.current_run.run_id', $active->uuid);
        $runs = collect($response->json('data.trucks.0.runs'))->keyBy('run_id');
        $this->assertTrue($runs[$overdue->uuid]['overdue']);
        $this->assertFalse($runs[$active->uuid]['overdue']);
        $this->assertArrayNotHasKey('track_points', $runs[$active->uuid]);
        $this->getJson('/api/v1/shipments?merchant_id='.$c['merchant']->uuid.'&unassigned=true', $c['headers'])->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_foreign_merchant_and_environment_selections_are_rejected(): void
    {
        $c = $this->context();
        $other = $this->context();
        $this->getJson('/api/v1/schedule?merchant_id='.$other['merchant']->uuid, $c['headers'])->assertStatus(422);
        $payload = $this->payload($c, now()->addDay()->toIso8601String());
        $payload['destination_location_id'] = $other['end']->uuid;
        $this->postJson('/api/v1/runs', $payload, $c['headers'])->assertUnprocessable();
        $environment = MerchantEnvironment::create(['merchant_id' => $other['merchant']->id, 'account_id' => $other['merchant']->account_id, 'name' => 'Other', 'color' => '#ffffff', 'url' => 'https://environment.example.test', 'token_hash' => hash('sha256', 'test-environment')]);
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&environment_id='.$environment->uuid, $c['headers'])->assertNotFound();
    }

    public function test_shared_driver_blocks_another_truck_and_legacy_ready_runs_keep_priority(): void
    {
        $c = $this->context();
        $legacy = Run::create(['account_id' => $c['merchant']->account_id, 'merchant_id' => $c['merchant']->id, 'driver_id' => $c['driver']->id, 'vehicle_id' => $c['vehicle']->id, 'status' => 'dispatched']);
        $c['vehicle'] = Vehicle::create(['account_id' => $c['merchant']->account_id, 'merchant_id' => $c['merchant']->id, 'plate_number' => 'SCHEDULE-2', 'is_active' => true]);
        $run = $this->create($c, $this->payload($c, now()->toIso8601String(), $this->shipment($c)));
        $this->assertSame('draft', $run->status);
        $legacy->update(['status' => 'cancelled']);
        app(RunReadinessService::class)->reconcile($c['merchant']->id);
        $this->assertSame('dispatched', $run->fresh()->status);
    }

    public function test_stale_driver_changes_and_rescheduling_cannot_override_current_work(): void
    {
        $c = $this->context();
        $run = $this->create($c, $this->payload($c, now()->toIso8601String(), $this->shipment($c)));
        $this->patchJson("/api/v1/runs/{$run->uuid}", ['driver_id' => null, 'expected_driver_id' => null], $c['headers'])->assertConflict();
        $this->patchJson("/api/v1/runs/{$run->uuid}", ['planned_start_at' => now()->addDays(2)->toIso8601String()], $c['headers'])->assertOk()->assertJsonPath('data.status', 'draft');
        $this->postJson("/api/v1/runs/{$run->uuid}/start", [], $c['headers'])->assertConflict();
        $this->assertSame($c['driver']->id, $run->fresh()->driver_id);
    }

    public function test_invalid_new_run_rolls_back_its_shipment_removal(): void
    {
        $c = $this->context();
        $other = $this->context();
        $shipment = $this->shipment($c);
        $source = $this->create($c, $this->payload($c, now()->addDay()->toIso8601String(), $shipment));
        $payload = $this->payload($c, now()->addDays(2)->toIso8601String(), $shipment) + ['expected_source_run_id' => $source->uuid];
        $payload['destination_location_id'] = $other['end']->uuid;
        $this->postJson('/api/v1/schedule/runs', $payload, $c['headers'])->assertUnprocessable();
        $this->assertDatabaseHas('run_shipments', ['run_id' => $source->id, 'shipment_id' => $shipment->id, 'status' => 'planned']);
        $this->assertSame(1, Run::where('merchant_id', $c['merchant']->id)->count());
    }

    public function test_board_paginates_filters_and_separates_environments_without_tokens(): void
    {
        $c = $this->context();
        for ($i = 0; $i < 31; $i++) {
            $this->shipment($c);
        }
        $environment = MerchantEnvironment::create(['account_id' => $c['merchant']->account_id, 'merchant_id' => $c['merchant']->id,
            'name' => 'Test', 'color' => '#ffffff', 'url' => 'https://test.example.test', 'token_hash' => hash('sha256', 'test')]);
        $specific = $this->shipment($c);
        $specific->update(['environment_id' => $environment->id]);
        $response = $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid, $c['headers'])->assertOk()->assertJsonCount(30, 'data.shipments')->assertJsonPath('data.pagination.shipments.total', 31);
        $this->assertArrayNotHasKey('token', $response->json('data.environments.0'));
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&shipment_page=2', $c['headers'])->assertOk()->assertJsonCount(1, 'data.shipments');
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&environment_id='.$environment->uuid, $c['headers'])->assertOk()->assertJsonCount(1, 'data.shipments')->assertJsonPath('data.shipments.0.shipment_id', $specific->uuid);
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&driver_filter=assigned', $c['headers'])->assertOk()->assertJsonCount(0, 'data.drivers');
        $this->getJson('/api/v1/schedule?merchant_id='.$c['merchant']->uuid.'&truck_search=missing', $c['headers'])->assertOk()->assertJsonCount(0, 'data.trucks');
    }

    public function test_unavailable_truck_and_terminal_only_shipment_leave_plan_waiting(): void
    {
        $c = $this->context();
        $c['vehicle']->update(['maintenance_mode_at' => now()]);
        $shipment = $this->shipment($c);
        $run = $this->create($c, $this->payload($c, now()->toIso8601String(), $shipment));
        $this->assertSame('draft', $run->status);
        $c['vehicle']->update(['maintenance_mode_at' => null]);
        $shipment->update(['status' => 'delivered']);
        app(RunReadinessService::class)->reconcile($c['merchant']->id);
        $this->assertSame('draft', $run->fresh()->status);
    }
}
