<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class ShipmentsFullReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_requires_merchant_id_when_no_merchant_environment_is_present(): void
    {
        [$user] = $this->createMerchantContext();

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report');

        $response->assertStatus(422)
            ->assertJsonPath('error.code', 'VALIDATION_ERROR')
            ->assertJsonPath('error.details.merchant_id.0', 'The merchant_id field is required.');
    }

    public function test_report_returns_only_shipments_for_the_requested_merchant(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $otherMerchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $otherMerchant->users()->attach($user->id, ['role' => 'owner']);

        $pickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $dropoff = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town');
        $otherPickup = $this->createLocation($account->id, $otherMerchant->id, 'Warehouse B', 'PICKUP-B', 'Durban');
        $otherDropoff = $this->createLocation($account->id, $otherMerchant->id, 'Store B', 'STORE-B', 'Durban');

        $selectedShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'ORDER-SELECTED',
            $pickup,
            $dropoff
        );
        $this->createShipment(
            $account->id,
            $otherMerchant->id,
            'ORDER-OTHER',
            $otherPickup,
            $otherDropoff
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?merchant_id='.$merchant->uuid);

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.shipment_id', $selectedShipmentUuid)
            ->assertJsonPath('data.0.shipment_number', 'ORDER-SELECTED');
    }

    public function test_report_returns_invoice_number_and_searches_all_filtered_rows_before_pagination(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $pickup = $this->createLocation($account->id, $merchant->id, 'Search Depot', 'SEARCH-DEPOT', 'Cape Town');
        $dropoff = $this->createLocation($account->id, $merchant->id, 'Search Store', 'SEARCH-STORE', 'Cape Town');
        $matchingShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'OLDER-MATCHING-SHIPMENT',
            $pickup,
            $dropoff
        );
        DB::table('shipments')
            ->where('uuid', $matchingShipmentUuid)
            ->update(['invoice_number' => 'INV-SEARCH-9001']);

        $this->createShipment(
            $account->id,
            $merchant->id,
            'NEWER-NON-MATCHING-SHIPMENT',
            $pickup,
            $dropoff
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'search' => 'INV-SEARCH-9001',
                'per_page' => 1,
            ]));

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.shipment_id', $matchingShipmentUuid)
            ->assertJsonPath('data.0.invoice_number', 'INV-SEARCH-9001');
    }

    public function test_report_filters_shipments_by_pickup_or_dropoff_location_tag(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $taggedPickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $taggedDropoff = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town');
        $untaggedLocation = $this->createLocation($account->id, $merchant->id, 'Plain Hub', 'PLAIN', 'Cape Town');
        $tagId = $this->createTag($account->id, $merchant->id, 'Depot', 'depot');
        $tagUuid = DB::table('tags')->where('id', $tagId)->value('uuid');

        $this->attachTagToLocation($tagId, $taggedPickup);
        $this->attachTagToLocation($tagId, $taggedDropoff);

        $pickupMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'PICKUP-MATCH',
            $taggedPickup,
            $untaggedLocation
        );
        $dropoffMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'DROPOFF-MATCH',
            $untaggedLocation,
            $taggedDropoff
        );
        $nonMatchUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'NO-MATCH',
            $untaggedLocation,
            $untaggedLocation
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'location_tag_id' => $tagUuid,
                'per_page' => 10,
            ]));

        $response->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonFragment(['shipment_id' => $pickupMatchUuid])
            ->assertJsonFragment(['shipment_id' => $dropoffMatchUuid])
            ->assertJsonMissing(['shipment_id' => $nonMatchUuid]);
    }

    public function test_report_filters_shipments_by_report_vehicle_tag(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $location = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town');
        $matchingVehicle = $this->createVehicle($account->id, $merchant->id, 'TAG-REPORT-1');
        $otherVehicle = $this->createVehicle($account->id, $merchant->id, 'TAG-REPORT-2');
        $tagId = $this->createTag($account->id, $merchant->id, 'Cold Chain', 'cold-chain');
        $tagUuid = DB::table('tags')->where('id', $tagId)->value('uuid');
        $this->attachTagToVehicle($tagId, $matchingVehicle);

        $matchingShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'VEHICLE-TAG-MATCH',
            $location,
            $location
        );
        $nonMatchShipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'VEHICLE-TAG-NO-MATCH',
            $location,
            $location
        );

        $this->attachShipmentToRun(
            $account->id,
            $merchant->id,
            (int) DB::table('shipments')->where('uuid', $matchingShipmentUuid)->value('id'),
            $matchingVehicle
        );
        $this->attachShipmentToRun(
            $account->id,
            $merchant->id,
            (int) DB::table('shipments')->where('uuid', $nonMatchShipmentUuid)->value('id'),
            $otherVehicle
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?'.http_build_query([
                'merchant_id' => $merchant->uuid,
                'vehicle_tag_id' => $tagUuid,
                'per_page' => 10,
            ]));

        $response->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonFragment(['shipment_id' => $matchingShipmentUuid])
            ->assertJsonMissing(['shipment_id' => $nonMatchShipmentUuid]);
    }

    public function test_report_prefers_real_location_visit_intervals_over_zero_length_stage_activities(): void
    {
        [$user, $merchant, $account] = $this->createMerchantContext();

        $pickup = $this->createLocation($account->id, $merchant->id, 'Warehouse A', 'PICKUP-A', 'Cape Town', 20);
        $dropoff = $this->createLocation($account->id, $merchant->id, 'Store A', 'STORE-A', 'Cape Town', 0);
        $vehicle = $this->createVehicle($account->id, $merchant->id, 'REPORT-INTERVALS');
        $shipmentUuid = $this->createShipment(
            $account->id,
            $merchant->id,
            'REPORT-INTERVALS',
            $pickup,
            $dropoff
        );
        $shipmentId = (int) DB::table('shipments')->where('uuid', $shipmentUuid)->value('id');
        $runId = $this->attachShipmentToRun($account->id, $merchant->id, $shipmentId, $vehicle);

        $this->createVehicleActivity(
            $account->id,
            $merchant->id,
            $vehicle,
            $pickup,
            $runId,
            null,
            VehicleActivity::EVENT_ENTERED_LOCATION,
            '2026-08-29 08:00:00',
            '2026-08-29 08:35:00'
        );
        $this->createVehicleActivity(
            $account->id,
            $merchant->id,
            $vehicle,
            $pickup,
            $runId,
            $shipmentId,
            VehicleActivity::EVENT_SHIPMENT_COLLECTION,
            '2026-08-29 08:00:01',
            '2026-08-29 08:00:01'
        );
        $this->createVehicleActivity(
            $account->id,
            $merchant->id,
            $vehicle,
            $dropoff,
            $runId,
            $shipmentId,
            VehicleActivity::EVENT_ENTERED_LOCATION,
            '2026-08-29 09:10:00',
            '2026-08-29 09:28:00'
        );
        $this->createVehicleActivity(
            $account->id,
            $merchant->id,
            $vehicle,
            $dropoff,
            $runId,
            $shipmentId,
            VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            '2026-08-29 09:28:00',
            '2026-08-29 09:28:00'
        );

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?merchant_id='.$merchant->uuid);

        $response->assertOk()
            ->assertJsonPath('data.0.from_vehicle_activity.event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->assertJsonPath('data.0.from_location.expected_waiting_time', 20)
            ->assertJsonMissingPath('data.0.from_location.estimated_waiting_time')
            ->assertJsonPath('data.0.from_time_in', '2026-08-29T08:00:00+00:00')
            ->assertJsonPath('data.0.from_time_out', '2026-08-29T08:35:00+00:00')
            ->assertJsonPath('data.0.from_time_to', '2026-08-29T08:35:00+00:00')
            ->assertJsonPath('data.0.to_vehicle_activity.event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->assertJsonPath('data.0.to_location.expected_waiting_time', 0)
            ->assertJsonPath('data.0.to_time_in', '2026-08-29T09:10:00+00:00')
            ->assertJsonPath('data.0.to_time_out', '2026-08-29T09:28:00+00:00');
    }

    public function test_report_returns_actual_delivery_timestamps_and_batched_speeding_summaries_for_each_transit_window(): void
    {
        Carbon::setTestNow('2026-08-30 12:00:00');
        [$user, $merchant, $account] = $this->createMerchantContext();

        $location = $this->createLocation($account->id, $merchant->id, 'Speed Depot', 'SPEED-DEPOT', 'Cape Town');
        $vehicle = $this->createVehicle($account->id, $merchant->id, 'SPEED-1');
        $otherVehicle = $this->createVehicle($account->id, $merchant->id, 'SPEED-2');

        $activeUuid = $this->createShipment($account->id, $merchant->id, 'ACTIVE-SPEED', $location, $location);
        $completedUuid = $this->createShipment($account->id, $merchant->id, 'COMPLETED-SPEED', $location, $location);
        $terminalWithoutEndUuid = $this->createShipment($account->id, $merchant->id, 'NO-END-SPEED', $location, $location);
        $activeId = (int) DB::table('shipments')->where('uuid', $activeUuid)->value('id');
        $completedId = (int) DB::table('shipments')->where('uuid', $completedUuid)->value('id');
        $terminalWithoutEndId = (int) DB::table('shipments')->where('uuid', $terminalWithoutEndUuid)->value('id');

        DB::table('shipments')->where('id', $activeId)->update(['status' => 'in_transit']);
        DB::table('shipments')->whereIn('id', [$completedId, $terminalWithoutEndId])->update(['status' => 'delivered']);
        $this->attachShipmentToRun($account->id, $merchant->id, $activeId, $vehicle);
        $this->attachShipmentToRun($account->id, $merchant->id, $completedId, $vehicle);
        $this->attachShipmentToRun($account->id, $merchant->id, $terminalWithoutEndId, $vehicle);

        $this->createBooking($account->id, $merchant->id, $activeId, 'in_transit', '2026-08-30 08:00:00');
        $this->createBooking($account->id, $merchant->id, $completedId, 'delivered', '2026-08-30 09:30:00', '2026-08-30 10:30:00');
        $this->createBooking($account->id, $merchant->id, $terminalWithoutEndId, 'delivered', '2026-08-30 08:00:00');

        $this->createSpeedingActivity($account->id, $merchant->id, $vehicle, '2026-08-30 07:59:00', 140, 80, -33.9000, 18.4000);
        $this->createSpeedingActivity($account->id, $merchant->id, $vehicle, '2026-08-30 09:00:00', 110, 80, -33.9100, 18.4100);
        $this->createSpeedingActivity($account->id, $merchant->id, $vehicle, '2026-08-30 10:00:00', 120, 100, -33.9200, 18.4200);
        $this->createSpeedingActivity($account->id, $merchant->id, $vehicle, '2026-08-30 11:00:00', 130, 100, -33.9300, 18.4300);
        $this->createSpeedingActivity($account->id, $merchant->id, $otherVehicle, '2026-08-30 10:00:00', 160, 80, -34.0000, 18.5000);

        $response = $this->withHeaders($this->authHeaders($user))
            ->getJson('/api/v1/reports/shipments_full_report?merchant_id='.$merchant->uuid)
            ->assertOk();

        $rows = collect($response->json('data'))->keyBy('shipment_id');
        $this->assertSame('2026-08-30T08:00:00+00:00', $rows[$activeUuid]['collected_at']);
        $this->assertNull($rows[$activeUuid]['delivered_at']);
        $this->assertSame(3, $rows[$activeUuid]['speeding_alert_count']);
        $this->assertSame(130, (int) $rows[$activeUuid]['speeding_highest_speed_kph']);
        $this->assertSame(30, (int) $rows[$activeUuid]['speeding_max_over_limit_kph']);
        $this->assertSame('2026-08-30T11:00:00+00:00', $rows[$activeUuid]['speeding_latest_at']);
        $this->assertCount(3, $rows[$activeUuid]['speeding_alerts']);
        $this->assertSame('2026-08-30T09:00:00+00:00', $rows[$activeUuid]['speeding_alerts'][0]['occurred_at']);
        $this->assertSame(110, (int) $rows[$activeUuid]['speeding_alerts'][0]['speed_kph']);
        $this->assertSame(80, (int) $rows[$activeUuid]['speeding_alerts'][0]['speed_limit_kph']);
        $this->assertSame(30, (int) $rows[$activeUuid]['speeding_alerts'][0]['over_limit_kph']);
        $this->assertSame(-33.91, $rows[$activeUuid]['speeding_alerts'][0]['latitude']);
        $this->assertSame(18.41, $rows[$activeUuid]['speeding_alerts'][0]['longitude']);

        $this->assertSame('2026-08-30T10:30:00+00:00', $rows[$completedUuid]['delivered_at']);
        $this->assertSame(1, $rows[$completedUuid]['speeding_alert_count']);
        $this->assertSame(120, (int) $rows[$completedUuid]['speeding_highest_speed_kph']);
        $this->assertCount(1, $rows[$completedUuid]['speeding_alerts']);
        $this->assertSame('2026-08-30T10:00:00+00:00', $rows[$completedUuid]['speeding_alerts'][0]['occurred_at']);
        $this->assertSame(0, $rows[$terminalWithoutEndUuid]['speeding_alert_count']);
        $this->assertSame([], $rows[$terminalWithoutEndUuid]['speeding_alerts']);

        Carbon::setTestNow();
    }

    private function createMerchantContext(): array
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        return [$user, $merchant, $account];
    }

    private function authHeaders(User $user): array
    {
        return [
            'Authorization' => 'Bearer '.$user->createToken('test-token')->plainTextToken,
            'Accept' => 'application/json',
        ];
    }

    private function createLocation(
        int $accountId,
        int $merchantId,
        string $name,
        string $code,
        string $city,
        ?int $expectedWaitingTime = null
    ): int {
        return DB::table('locations')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'environment_id' => null,
            'name' => $name,
            'code' => $code,
            'company' => null,
            'address_line_1' => "{$name} address",
            'address_line_2' => null,
            'town' => null,
            'city' => $city,
            'country' => 'ZA',
            'first_name' => null,
            'last_name' => null,
            'phone' => null,
            'expected_waiting_time' => $expectedWaitingTime,
            'province' => 'Western Cape',
            'post_code' => '8000',
            'latitude' => null,
            'longitude' => null,
            'google_place_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }

    private function createShipment(
        int $accountId,
        int $merchantId,
        string $orderRef,
        int $pickupLocationId,
        int $dropoffLocationId
    ): string {
        $uuid = (string) Str::uuid();
        $createdAt = Carbon::now();

        DB::table('shipments')->insert([
            'uuid' => $uuid,
            'merchant_id' => $merchantId,
            'merchant_order_ref' => $orderRef,
            'status' => 'draft',
            'account_id' => $accountId,
            'environment_id' => null,
            'pickup_location_id' => $pickupLocationId,
            'dropoff_location_id' => $dropoffLocationId,
            'collection_date' => $createdAt,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
            'deleted_at' => null,
        ]);

        return $uuid;
    }

    private function createTag(int $accountId, int $merchantId, string $name, string $slug): int
    {
        return DB::table('tags')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'name' => $name,
            'slug' => $slug,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function createVehicle(int $accountId, int $merchantId, string $plateNumber): int
    {
        return DB::table('vehicles')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'plate_number' => $plateNumber,
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }

    private function createBooking(
        int $accountId,
        int $merchantId,
        int $shipmentId,
        string $status,
        string $collectedAt,
        ?string $deliveredAt = null
    ): void {
        DB::table('bookings')->insert([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'shipment_id' => $shipmentId,
            'quote_option_id' => null,
            'status' => $status,
            'carrier_code' => 'internal',
            'booked_at' => $collectedAt,
            'collected_at' => $collectedAt,
            'delivered_at' => $deliveredAt,
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);
    }

    private function createSpeedingActivity(
        int $accountId,
        int $merchantId,
        int $vehicleId,
        string $occurredAt,
        float $speedKph,
        float $speedLimitKph,
        ?float $latitude = null,
        ?float $longitude = null
    ): void {
        DB::table('vehicle_activity')->insert([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'vehicle_id' => $vehicleId,
            'event_type' => VehicleActivity::EVENT_SPEEDING,
            'occurred_at' => $occurredAt,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'speed_kph' => $speedKph,
            'speed_limit_kph' => $speedLimitKph,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachTagToLocation(int $tagId, int $locationId): void
    {
        DB::table('taggables')->insert([
            'tag_id' => $tagId,
            'taggable_type' => \App\Models\Location::class,
            'taggable_id' => $locationId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachTagToVehicle(int $tagId, int $vehicleId): void
    {
        DB::table('taggables')->insert([
            'tag_id' => $tagId,
            'taggable_type' => \App\Models\Vehicle::class,
            'taggable_id' => $vehicleId,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachShipmentToRun(int $accountId, int $merchantId, int $shipmentId, int $vehicleId): int
    {
        $runId = DB::table('runs')->insertGetId([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'vehicle_id' => $vehicleId,
            'status' => 'dispatched',
            'created_at' => now(),
            'updated_at' => now(),
            'deleted_at' => null,
        ]);

        DB::table('run_shipments')->insert([
            'uuid' => (string) Str::uuid(),
            'run_id' => $runId,
            'shipment_id' => $shipmentId,
            'sequence' => 1,
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $runId;
    }

    private function createVehicleActivity(
        int $accountId,
        int $merchantId,
        int $vehicleId,
        int $locationId,
        int $runId,
        ?int $shipmentId,
        string $eventType,
        string $enteredAt,
        string $exitedAt
    ): void {
        DB::table('vehicle_activity')->insert([
            'uuid' => (string) Str::uuid(),
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'vehicle_id' => $vehicleId,
            'location_id' => $locationId,
            'run_id' => $runId,
            'shipment_id' => $shipmentId,
            'event_type' => $eventType,
            'occurred_at' => $enteredAt,
            'entered_at' => $enteredAt,
            'exited_at' => $exitedAt,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
