<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Driver;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Booking;
use App\Models\Shipment;
use App\Models\ShipmentParcel;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\AutoRunLifecycleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AutoRunLifecycleServiceTest extends TestCase
{
    use RefreshDatabase;

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_it_auto_manages_runs_and_shipments_from_location_entries(): void
    {
        Carbon::setTestNow('2026-02-21 08:00:00');

        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $locationA = $this->createLocation($merchant, 'Location A', true, -33.9200, 18.4200);
        $locationB = $this->createLocation($merchant, 'Location B', false, -33.9300, 18.4300);
        $locationC = $this->createLocation($merchant, 'Location C', false, -33.9400, 18.4400);
        $locationD = $this->createLocation($merchant, 'Location D', true, -33.9500, 18.4500);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-02-21 08:00:00')); // A enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:10:00')); // A exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9300, 18.4300, Carbon::parse('2026-02-21 08:20:00')); // B enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:30:00')); // B exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9300, 18.4300, Carbon::parse('2026-02-21 08:40:00')); // B re-enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:50:00')); // B exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9400, 18.4400, Carbon::parse('2026-02-21 09:00:00')); // C enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9500, 18.4500, Carbon::parse('2026-02-21 09:10:00')); // D enter

        $runs = Run::query()->where('merchant_id', $merchant->id)->orderBy('id')->get();
        $this->assertCount(2, $runs);

        $firstRun = $runs[0];
        $secondRun = $runs[1];

        $this->assertSame(Run::STATUS_COMPLETED, $firstRun->status);
        $this->assertSame($locationA->id, $firstRun->origin_location_id);
        $this->assertSame($locationD->id, $firstRun->destination_location_id);

        $this->assertSame(Run::STATUS_IN_PROGRESS, $secondRun->status);
        $this->assertSame($locationD->id, $secondRun->origin_location_id);

        $shipments = Shipment::query()->where('merchant_id', $merchant->id)->orderBy('id')->get();
        $this->assertCount(2, $shipments);
        $this->assertSame([$locationB->id, $locationC->id], $shipments->pluck('dropoff_location_id')->values()->all());
        $this->assertSame([$locationA->id, $locationA->id], $shipments->pluck('pickup_location_id')->values()->all());

        $shipmentToB = $shipments->firstWhere('dropoff_location_id', $locationB->id);
        $shipmentToC = $shipments->firstWhere('dropoff_location_id', $locationC->id);
        $this->assertNull($shipmentToB->metadata['auto_delivery_attempts'] ?? null);
        $this->assertSame('in_transit', $shipmentToC->status);
        $this->assertSame('2026-02-21T08:00:01+00:00', $shipmentToB->collection_date?->toIso8601String());
        $this->assertSame('2026-02-21T08:00:01+00:00', $shipmentToC->collection_date?->toIso8601String());
        $this->assertDatabaseCount('bookings', 2);
        $this->assertDatabaseCount('shipment_parcels', 2);

        $bookingToB = Booking::query()->where('shipment_id', $shipmentToB->id)->first();
        $bookingToC = Booking::query()->where('shipment_id', $shipmentToC->id)->first();
        $this->assertNotNull($bookingToB);
        $this->assertNotNull($bookingToC);
        $this->assertSame('delivered', $bookingToB->status);
        $this->assertNotNull($bookingToB->booked_at);
        $this->assertNotNull($bookingToB->collected_at);
        $this->assertNotNull($bookingToB->delivered_at);
        $this->assertSame('in_transit', $bookingToC->status);
        $this->assertNotNull($bookingToC->booked_at);
        $this->assertNotNull($bookingToC->collected_at);
        $this->assertNull($bookingToC->delivered_at);
        $this->assertDatabaseHas('shipment_parcels', [
            'shipment_id' => $shipmentToB->id,
            'contents_description' => 'Parcel #1',
        ]);
        $this->assertDatabaseHas('shipment_parcels', [
            'shipment_id' => $shipmentToC->id,
            'contents_description' => 'Parcel #1',
        ]);

        $parcelToB = ShipmentParcel::query()->where('shipment_id', $shipmentToB->id)->first();
        $parcelToC = ShipmentParcel::query()->where('shipment_id', $shipmentToC->id)->first();
        $this->assertNotNull($parcelToB?->parcel_code);
        $this->assertNotNull($parcelToC?->parcel_code);
        $this->assertNull($parcelToB?->weight);
        $this->assertNull($parcelToB?->weight_measurement);
        $this->assertNull($parcelToB?->length_cm);
        $this->assertNull($parcelToB?->width_cm);
        $this->assertNull($parcelToB?->height_cm);

        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $firstRun->id,
            'shipment_id' => $shipmentToB->id,
            'status' => RunShipment::STATUS_DONE,
        ]);

        $this->assertDatabaseHas('vehicle_activity', [
            'run_id' => $firstRun->id,
            'shipment_id' => $shipmentToB->id,
            'location_id' => $locationA->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_COLLECTION,
        ]);
        $this->assertDatabaseHas('vehicle_activity', [
            'run_id' => $firstRun->id,
            'shipment_id' => $shipmentToB->id,
            'location_id' => $locationB->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ]);

        $openVisit = VehicleActivity::query()
            ->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->whereNull('exited_at')
            ->first();

        $this->assertNotNull($openVisit);
        $this->assertSame($locationD->id, $openVisit->location_id);
        $this->assertSame($secondRun->id, $openVisit->run_id);
    }

    public function test_it_only_logs_visits_when_auto_creation_setting_is_disabled(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $this->createLocation($merchant, 'Loading A', true, -33.9200, 18.4200);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-02-21 10:00:00'));

        $this->assertDatabaseCount('vehicle_activity', 1);
        $this->assertDatabaseCount('runs', 0);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_it_does_not_force_timeout_exit_for_non_loading_visits(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $location = $this->createLocation($merchant, 'Timeout Location', false, -33.9000, 18.4000);

        $service->processVehiclePosition($vehicle, $merchant, -33.9000, 18.4000, Carbon::parse('2026-02-10 10:00:00'));
        $service->processVehiclePosition($vehicle, $merchant, -33.9001, 18.4001, Carbon::parse('2026-02-21 10:00:00'));

        $visit = VehicleActivity::query()
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->where('location_id', $location->id)
            ->first();

        $this->assertNotNull($visit);
        $this->assertNull($visit->exited_at);
        $this->assertNull($visit->exit_reason);
    }

    public function test_it_links_auto_created_run_to_driver_by_integration_id_when_present(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $driverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $driverUser->forceFill(['account_id' => $merchant->account_id])->save();

        $driver = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUser->id,
            'intergration_id' => 'drv-123',
            'is_active' => true,
        ]);

        $this->createLocation($merchant, 'Loading A', true, -33.9200, 18.4200);

        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-21 11:00:00'),
            null,
            null,
            null,
            'drv-123'
        );

        $run = Run::query()
            ->where('merchant_id', $merchant->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($run);
        $this->assertSame($driver->id, $run->driver_id);
    }

    public function test_it_links_auto_created_run_to_driver_using_matching_merchant_when_integration_ids_collide(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $otherMerchant = Merchant::create([
            'account_id' => $merchant->account_id,
            'owner_user_id' => $merchant->owner_user_id,
            'name' => 'Other Merchant',
            'legal_name' => 'Other Merchant LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
        ]);

        $wrongDriverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $wrongDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $wrongDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $wrongDriverUser->id,
            'intergration_id' => 'drv-123',
            'is_active' => true,
        ]);

        $correctDriverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $correctDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $correctDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $correctDriverUser->id,
            'intergration_id' => 'drv-123',
            'is_active' => true,
        ]);

        $this->createLocation($merchant, 'Loading A', true, -33.9200, 18.4200);

        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-21 11:00:00'),
            null,
            null,
            null,
            'drv-123'
        );

        $run = Run::query()
            ->where('merchant_id', $merchant->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($run);
        $this->assertSame($correctDriver->id, $run->driver_id);
        $this->assertNotSame($wrongDriver->id, $run->driver_id);
    }

    public function test_it_executes_saved_location_automation_rules_for_non_default_location_types(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $siteType = LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'slug' => 'site',
            'title' => 'Site',
            'collection_point' => false,
            'delivery_point' => false,
            'sequence' => 10,
            'default' => false,
        ]);

        $merchant->location_automation_settings = [
            'location_types' => [
                [
                    'location_type_id' => $siteType->uuid,
                    'location_type_name' => 'Site',
                    'location_type_slug' => 'site',
                    'location_type_icon' => null,
                    'location_type_color' => null,
                    'entry' => [
                        ['id' => 'entry-record', 'action' => 'record_vehicle_entry', 'conditions' => []],
                        ['id' => 'entry-start-run', 'action' => 'start_run', 'conditions' => []],
                    ],
                    'exit' => [
                        ['id' => 'exit-record', 'action' => 'record_vehicle_exit', 'conditions' => []],
                    ],
                ],
            ],
        ];
        $merchant->save();

        $location = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Custom Site',
            'address_line_1' => '100 Automation Ave',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => -33.9600,
            'longitude' => 18.4600,
            'location_type_id' => $siteType->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);

        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9600, 18.4600, Carbon::parse('2026-03-04 08:00:00'));
        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9050, 18.4050, Carbon::parse('2026-03-04 08:15:00'));

        $run = Run::query()->where('merchant_id', $merchant->id)->latest('id')->first();

        $this->assertNotNull($run);
        $this->assertSame(Run::STATUS_IN_PROGRESS, $run->status);
        $this->assertSame($location->id, $run->origin_location_id);
        $this->assertNull($run->origin_departure_time);

        $visit = VehicleActivity::query()
            ->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('location_id', $location->id)
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->latest('id')
            ->first();

        $this->assertNotNull($visit);
        $this->assertNotEmpty($visit->metadata['automation'] ?? []);
    }

    public function test_it_keeps_existing_run_open_at_new_collection_when_no_shipments_exist(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $locationA = $this->createLocation($merchant, 'Collection A', true, -33.9200, 18.4200);
        $locationB = $this->createLocation($merchant, 'Collection B', true, -33.9500, 18.4500);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-04 09:00:00'));
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-03-04 09:10:00'));
        $service->processVehiclePosition($vehicle, $merchant, -33.9500, 18.4500, Carbon::parse('2026-03-04 09:20:00'));

        $this->assertDatabaseCount('runs', 1);
        $run = Run::query()->where('merchant_id', $merchant->id)->firstOrFail();
        $this->assertSame(Run::STATUS_IN_PROGRESS, $run->status);
        $this->assertSame($locationA->id, $run->origin_location_id);
        $this->assertNull($run->completed_at);

        $activeVisit = VehicleActivity::query()
            ->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->where('location_id', $locationB->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($activeVisit);
        $this->assertSame($run->id, $activeVisit->run_id);
    }

    public function test_it_backfills_missing_bookings_for_auto_created_shipments(): void
    {
        Carbon::setTestNow('2026-03-01 09:00:00');

        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $this->createLocation($merchant, 'Loading A', true, -33.9200, 18.4200);
        $locationB = $this->createLocation($merchant, 'Location B', false, -33.9300, 18.4300);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-01 09:00:00'));
        $service->processVehiclePosition($vehicle, $merchant, -33.9300, 18.4300, Carbon::parse('2026-03-01 09:10:00'));

        $shipment = Shipment::query()->where('merchant_id', $merchant->id)->firstOrFail();
        Booking::query()->where('shipment_id', $shipment->id)->forceDelete();

        $this->assertDatabaseMissing('bookings', ['shipment_id' => $shipment->id]);

        $this->artisan('shipments:backfill-auto-bookings')
            ->expectsOutputToContain('Auto shipment booking backfill summary:')
            ->assertExitCode(0);

        $booking = Booking::query()->where('shipment_id', $shipment->id)->first();
        $this->assertNotNull($booking);
        $this->assertSame('in_transit', $booking->status);
        $this->assertNotNull($booking->booked_at);
        $this->assertNotNull($booking->collected_at);
    }

    public function test_it_backfills_missing_parcels_for_auto_created_shipments(): void
    {
        Carbon::setTestNow('2026-03-01 10:00:00');

        [$merchant] = $this->createMerchantVehicleContext(true);

        $pickup = $this->createLocation($merchant, 'Loading A', true, -33.9200, 18.4200);
        $dropoff = $this->createLocation($merchant, 'Location B', false, -33.9300, 18.4300);

        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'AUTO-MISSING-PARCEL',
            'status' => 'in_transit',
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'auto_assign' => true,
            'auto_created' => true,
            'notes' => 'Auto-created from test fixture.',
        ]);

        $this->assertDatabaseMissing('shipment_parcels', [
            'shipment_id' => $shipment->id,
        ]);

        $this->artisan('shipments:backfill-auto-created-parcels')
            ->expectsOutputToContain('Auto-created shipment parcel backfill summary:')
            ->assertExitCode(0);

        $parcel = ShipmentParcel::query()->where('shipment_id', $shipment->id)->first();

        $this->assertNotNull($parcel);
        $this->assertSame('Parcel #1', $parcel->contents_description);
        $this->assertNotNull($parcel->parcel_code);
        $this->assertNull($parcel->weight);
        $this->assertNull($parcel->weight_measurement);
        $this->assertNull($parcel->length_cm);
        $this->assertNull($parcel->width_cm);
        $this->assertNull($parcel->height_cm);
    }

    public function test_it_updates_vehicle_last_known_driver_from_tracking_events(): void
    {
        Carbon::setTestNow('2026-02-28 08:00:00');

        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $driverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $driverUser->forceFill(['account_id' => $merchant->account_id])->save();

        $driver = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUser->id,
            'intergration_id' => 'drv-live',
            'is_active' => true,
        ]);

        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-28 07:30:00'),
            40,
            60,
            null,
            'drv-live'
        );

        $vehicle->refresh();

        $this->assertSame($driver->id, $vehicle->last_driver_id);
        $this->assertSame('2026-02-28T08:00:00+00:00', $vehicle->driver_logged_at?->toIso8601String());
    }

    public function test_it_updates_vehicle_last_known_driver_using_matching_merchant_when_integration_ids_collide(): void
    {
        Carbon::setTestNow('2026-02-28 08:00:00');

        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $otherMerchant = Merchant::create([
            'account_id' => $merchant->account_id,
            'owner_user_id' => $merchant->owner_user_id,
            'name' => 'Other Merchant',
            'legal_name' => 'Other Merchant LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
        ]);

        $wrongDriverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $wrongDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $wrongDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $wrongDriverUser->id,
            'intergration_id' => 'drv-live',
            'is_active' => true,
        ]);

        $correctDriverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $correctDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $correctDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $correctDriverUser->id,
            'intergration_id' => 'drv-live',
            'is_active' => true,
        ]);

        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-28 07:30:00'),
            40,
            60,
            null,
            'drv-live'
        );

        $vehicle->refresh();

        $this->assertSame($correctDriver->id, $vehicle->last_driver_id);
        $this->assertNotSame($wrongDriver->id, $vehicle->last_driver_id);
        $this->assertSame('2026-02-28T08:00:00+00:00', $vehicle->driver_logged_at?->toIso8601String());
    }

    public function test_it_does_not_overwrite_vehicle_last_known_driver_with_older_logged_event(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $driverUserA = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $driverUserA->forceFill(['account_id' => $merchant->account_id])->save();
        $driverA = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUserA->id,
            'intergration_id' => 'drv-a',
            'is_active' => true,
        ]);

        $driverUserB = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $driverUserB->forceFill(['account_id' => $merchant->account_id])->save();
        $driverB = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUserB->id,
            'intergration_id' => 'drv-b',
            'is_active' => true,
        ]);

        Carbon::setTestNow('2026-02-28 09:00:00');
        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-28 07:30:00'),
            30,
            60,
            null,
            'drv-a'
        );

        Carbon::setTestNow('2026-02-28 08:00:00');
        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9201,
            18.4201,
            Carbon::parse('2026-02-28 08:30:00'),
            0,
            60,
            null,
            'drv-b'
        );

        $vehicle->refresh();

        $this->assertSame($driverA->id, $vehicle->last_driver_id);
        $this->assertNotSame($driverB->id, $vehicle->last_driver_id);
        $this->assertSame('2026-02-28T09:00:00+00:00', $vehicle->driver_logged_at?->toIso8601String());
    }

    public function test_it_keeps_vehicle_last_known_driver_when_tracking_event_has_no_driver(): void
    {
        Carbon::setTestNow('2026-02-28 10:00:00');

        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);

        $driverUser = User::withoutEvents(fn () => User::factory()->create(['role' => 'driver']));
        $driverUser->forceFill(['account_id' => $merchant->account_id])->save();

        $driver = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUser->id,
            'intergration_id' => 'drv-sticky',
            'is_active' => true,
        ]);

        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9200,
            18.4200,
            Carbon::parse('2026-02-28 09:00:00'),
            35,
            60,
            null,
            'drv-sticky'
        );

        Carbon::setTestNow('2026-02-28 11:00:00');
        $service->processVehiclePosition(
            $vehicle,
            $merchant,
            -33.9300,
            18.4300,
            Carbon::parse('2026-02-28 09:30:00'),
            20,
            60,
            null,
            null
        );

        $vehicle->refresh();

        $this->assertSame($driver->id, $vehicle->last_driver_id);
        $this->assertSame('2026-02-28T10:00:00+00:00', $vehicle->driver_logged_at?->toIso8601String());
    }

    private function createMerchantVehicleContext(bool $allowAutoCreation): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['role' => 'user']));

        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::create([
            'account_id' => $account->id,
            'owner_user_id' => $user->id,
            'name' => fake()->company(),
            'legal_name' => fake()->company().' LLC',
            'status' => 'active',
            'timezone' => 'UTC',
            'operating_countries' => ['US'],
            'allow_auto_shipment_creations_at_locations' => $allowAutoCreation,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $vehicle = Vehicle::create([
            'account_id' => $merchant->account_id,
            'plate_number' => strtoupper(fake()->bothify('??-####')),
            'is_active' => true,
        ]);

        return [$merchant, $vehicle];
    }

    private function createLocation(Merchant $merchant, string $name, bool $isCollectionPoint, float $lat, float $lng): Location
    {
        $type = $this->firstOrCreateLocationType($merchant, $isCollectionPoint);

        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'address_line_1' => '123 Main St',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => $lat,
            'longitude' => $lng,
            'location_type_id' => $type->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);
    }

    private function firstOrCreateLocationType(Merchant $merchant, bool $isCollectionPoint): LocationType
    {
        if ($isCollectionPoint) {
            return LocationType::firstOrCreate(
                ['merchant_id' => $merchant->id, 'slug' => 'pickup'],
                [
                    'account_id' => $merchant->account_id,
                    'title' => 'Pickup',
                    'collection_point' => true,
                    'delivery_point' => false,
                    'sequence' => 2,
                    'default' => true,
                ]
            );
        }

        return LocationType::firstOrCreate(
            ['merchant_id' => $merchant->id, 'slug' => 'dropoff'],
            [
                'account_id' => $merchant->account_id,
                'title' => 'Dropoff',
                'collection_point' => false,
                'delivery_point' => true,
                'sequence' => 3,
                'default' => false,
            ]
        );
    }
}
