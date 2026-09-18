<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\Run;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleLocationHistory;
use App\Services\RunTrackService;
use App\Services\VehicleLocationHistoryService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class VehicleLocationHistoryTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        config(['vehicle_history.recording_enabled' => true, 'vehicle_history.display_enabled' => true]);
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $vehicle = Vehicle::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'plate_number' => 'TEST']);
        // The recorder only needs the integration identity and owning merchant.
        $integration = new MerchantIntegration;
        $integration->forceFill(['id' => 17, 'merchant_id' => $merchant->id]);
        $run = Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'started_at' => '2026-09-18 08:00:00', 'status' => Run::STATUS_IN_PROGRESS]);

        return [$user, $vehicle, $integration, $run];
    }

    public function test_stationary_merging_retries_motion_drift_late_samples_and_boundaries(): void
    {
        [, $vehicle, $integration, $run] = $this->context();
        $service = app(VehicleLocationHistoryService::class);
        $record = fn ($time, $lat, $speed) => $service->record($vehicle, $integration, Carbon::parse('2026-09-18 '.$time), $lat, 30, $speed, 1000);
        $first = $record('08:00:00', -30, 0);
        $record('08:01:00', -30.00001, 1);
        $this->assertSame(1, VehicleLocationHistory::count());
        $this->assertSame(2, $first->fresh()->sample_count);
        $this->assertEquals(-30, $first->fresh()->latitude);
        $record('08:01:00', -30.00001, 1);
        $record('08:00:00', -30, 0);
        $this->assertSame(2, $first->fresh()->sample_count);
        $record('08:02:00', -30.01, 0); // beyond radius
        $record('08:03:00', -30.02, 40);
        $record('08:04:00', -30.03, null);
        $late = $record('07:59:00', -30.01, 10);
        $this->assertTrue($late->delayed);
        $this->assertNull($late->run_id);
        $this->assertSame(5, VehicleLocationHistory::count());
        $this->assertNull($record('08:05:00', 91, 0));
        $run->update(['completed_at' => '2026-09-18 08:04:00']);
        $this->assertNull($record('08:06:00', -30.03, 0)->run_id);
        $record('08:12:00', -30.03, 0);
        $this->assertSame(7, VehicleLocationHistory::count());
    }

    public function test_overlapping_runs_remain_unassigned_and_integration_changes_split_stops(): void
    {
        [, $vehicle, $integration, $run] = $this->context();
        $service = app(VehicleLocationHistoryService::class);
        $at = Carbon::parse('2026-09-18 08:01:00');
        $service->record($vehicle, $integration, $at, -30, 30, 0, null);
        $integration->id = 18;
        $service->record($vehicle, $integration, $at->copy()->addMinute(), -30, 30, 0, null);
        $this->assertSame(2, VehicleLocationHistory::count());
        $copy = $run->replicate(['uuid']);
        $copy->save();
        $point = $service->record($vehicle, $integration, $at->copy()->addMinutes(2), -30, 30, 0, null);
        $this->assertNull($point->run_id);
    }

    public function test_track_is_bounded_with_stop_boundaries_gaps_and_no_change_to_run_totals(): void
    {
        [, $vehicle, $integration, $run] = $this->context();
        $at = Carbon::parse('2026-09-18 08:00:00');
        $batch = [];
        for ($i = 0; $i < 5000; $i++) {
            $time = $at->copy()->addSeconds($i * 10 + ($i >= 2500 ? 600 : 0));
            $batch[] = ['account_id' => $vehicle->account_id, 'merchant_id' => $integration->merchant_id, 'vehicle_id' => $vehicle->id,
                'merchant_integration_id' => 17, 'run_id' => $run->id, 'stationary' => $i === 100,
                'observed_at' => $time, 'last_seen_at' => $time, 'received_at' => $time, 'latitude' => -30 + $i / 100000,
                'longitude' => 30, 'last_latitude' => -30 + $i / 100000, 'last_longitude' => 30, 'first_sample_key' => hash('sha256', (string) $i)];
            if (count($batch) === 200) {
                DB::table('vehicle_location_history')->insert($batch);
                $batch = [];
            }
        }
        $track = app(RunTrackService::class)->get($run);
        $this->assertLessThanOrEqual(2000, $track['coverage']['displayed_coordinates']);
        $this->assertCount(2, $track['segments']);
        $this->assertCount(1, $track['stops']);
        $this->assertEquals(-30, $track['segments'][0][0]['latitude']);
        $this->assertEquals(-30 + 4999 / 100000, end($track['segments'][1])['latitude']);
        $this->assertNull($run->fresh()->odometer_end_km);
    }

    public function test_timezones_microseconds_and_cancelled_run_assignment(): void
    {
        [, $vehicle, $integration, $run] = $this->context();
        $service = app(VehicleLocationHistoryService::class);
        $at = Carbon::parse('2026-09-18T10:00:00.123456+02:00');
        $row = $service->record($vehicle, $integration, $at, -30, 30, 0, null);
        $this->assertEquals($run->id, $row->run_id);
        $this->assertSame('08:00:00.123456', $row->fresh()->observed_at->format('H:i:s.u'));
        $this->assertNull($service->record($vehicle, $integration, $at->copy()->utc(), -30, 30, 0, null));
        $run->update(['status' => Run::STATUS_CANCELLED]);
        $this->assertNull($service->record($vehicle, $integration, $at->copy()->addMinute(), -30, 30, 0, null)->run_id);
    }

    public function test_driver_must_be_assigned_and_in_the_same_merchant(): void
    {
        [, $vehicle, , $run] = $this->context();
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $vehicle->account_id]);
        $driver = \App\Models\Driver::create(['user_id' => $user->id, 'merchant_id' => $run->merchant_id, 'account_id' => $run->account_id, 'is_active' => true]);
        $this->withToken($user->createToken('driver')->plainTextToken);
        $url = '/api/v1/driver/runs/'.$run->uuid.'/track';
        $this->getJson($url)->assertNotFound();
        $run->update(['driver_id' => $driver->id]);
        $this->getJson($url)->assertOk();
        $run->update(['merchant_id' => Merchant::factory()->create()->id]);
        $this->getJson($url)->assertNotFound();
    }

    public function test_many_stop_boundaries_are_bounded_and_page_without_losing_stops(): void
    {
        [, $vehicle, $integration, $run] = $this->context();
        $at = Carbon::parse('2026-09-18 08:00:00');
        $batch = [];
        for ($i = 0; $i < 12000; $i++) {
            $time = $at->copy()->addMinute($i);
            $batch[] = ['account_id' => $vehicle->account_id, 'merchant_id' => $integration->merchant_id, 'vehicle_id' => $vehicle->id,
                'merchant_integration_id' => 17, 'run_id' => $run->id, 'stationary' => $i % 2 === 0,
                'observed_at' => $time, 'last_seen_at' => $time->copy()->addSeconds($i % 2 === 0 ? 30 : 0), 'received_at' => $time,
                'latitude' => -30, 'longitude' => 30, 'last_latitude' => -30, 'last_longitude' => 30, 'first_sample_key' => hash('sha256', (string) $i)];
            if (count($batch) === 200) {
                DB::table('vehicle_location_history')->insert($batch);
                $batch = [];
            }
        }
        $service = app(RunTrackService::class);
        $cursor = null;
        $seen = [];
        $pages = 0;
        do {
            $track = $service->get($run, $cursor);
            $this->assertLessThanOrEqual(2000, $track['coverage']['displayed_coordinates']);
            $this->assertLessThan(700000, strlen(json_encode($track)));
            foreach ($track['stops'] as $stop) {
                $seen[$stop['first_seen_at']] = true;
            }
            $cursor = $track['coverage']['next_before'];
            $this->assertLessThan(20, ++$pages);
        } while ($cursor);
        $this->assertCount(6000, $seen);
        $plan = DB::select('EXPLAIN QUERY PLAN SELECT * FROM vehicle_location_history WHERE run_id = ? ORDER BY observed_at DESC, id DESC LIMIT 10001', [$run->id]);
        $this->assertStringContainsString('INDEX', json_encode($plan));
    }

    public function test_run_lists_never_query_location_history(): void
    {
        [$user, , , $run] = $this->context();
        DB::enableQueryLog();
        $this->withToken($user->createToken('list')->plainTextToken)->withHeader('X-Merchant-Id', $run->merchant->uuid)->getJson('/api/v1/runs')->assertOk();
        $queries = json_encode(DB::getQueryLog());
        DB::disableQueryLog();
        $this->assertStringNotContainsString('vehicle_location_history', $queries);
        $this->assertStringNotContainsString('vehicle_location_receipts', $queries);
    }

    public function test_track_endpoint_authorization_empty_and_feature_flags(): void
    {
        [$user, , , $run] = $this->context();
        $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/runs/'.$run->uuid.'/track')->assertOk()->assertJsonPath('data.status', 'empty');
        $other = User::factory()->create();
        $this->withToken($other->createToken('test')->plainTextToken)->getJson('/api/v1/runs/'.$run->uuid.'/track')->assertForbidden();
        $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/runs/'.$run->uuid.'/track?before=bad')->assertUnprocessable();
        config(['vehicle_history.display_enabled' => false]);
        $this->withToken($user->createToken('test')->plainTextToken)->getJson('/api/v1/runs/'.$run->uuid.'/track')->assertOk()->assertJsonPath('data.status', 'disabled');
    }
}
