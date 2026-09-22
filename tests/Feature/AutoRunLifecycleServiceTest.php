<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Booking;
use App\Models\Driver;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\ShipmentParcel;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\AutoRunLifecycleService;
use App\Services\InternalBookingLifecycleService;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class AutoRunLifecycleServiceTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\DrawnGeofence;

    public function test_only_drawn_polygon_contains_truck_and_radius_cannot_keep_visit_open(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $location = $this->createLocation($merchant, 'Depot', true, -33.92, 18.42);
        $location->update(['polygon_bounds' => 'POLYGON((18.4199 -33.9201, 18.4201 -33.9201, 18.4201 -33.9199, 18.4199 -33.9199, 18.4199 -33.9201))']);
        $service = app(AutoRunLifecycleService::class);
        $at = Carbon::parse('2026-09-22 08:00:00');
        // About 18 metres from the centre: within the old radius, outside the polygon.
        $this->assertFalse($service->processVehiclePosition($vehicle, $merchant, -33.92, 18.4202, $at));
        $this->assertDatabaseCount('runs', 0);
        $this->assertDatabaseCount('shipments', 0);
        $this->assertSame(0, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->count());
        $this->assertTrue($service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at->copy()->addMinute()));
        $visit = VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->sole();
        $this->assertTrue($service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at->copy()->addMinutes(2)));
        $this->assertNull($visit->fresh()->exited_at);
        $this->assertFalse($service->processVehiclePosition($vehicle, $merchant, -33.92, 18.4202, $at->copy()->addMinutes(3)));
        $this->assertNotNull($visit->fresh()->exited_at);
        $this->assertSame(1, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->count());
    }

    public function test_missing_invalid_or_boundary_polygon_never_creates_a_visit(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $location = $this->createLocation($merchant, 'Depot', true, -33.92, 18.42);
        $service = app(AutoRunLifecycleService::class);
        foreach ([null, 'invalid', 'POLYGON((18.42 -33.92, 18.43 -33.92, 18.43 -33.91, 18.42 -33.91, 18.42 -33.92))'] as $polygon) {
            $location->update(['polygon_bounds' => $polygon]);
            $this->assertFalse($service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, Carbon::now()));
        }
        $this->assertSame(0, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->count());
        $this->assertDatabaseCount('runs', 0);
        $this->assertDatabaseCount('shipments', 0);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_driver_planned_run_starts_on_departure_and_is_not_closed_at_end(): void
    {
        Carbon::setTestNow('2026-09-16 08:00:00');
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $user = $this->createUserWithoutEvents(['role' => 'driver', 'account_id' => $merchant->account_id]);
        $driver = Driver::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);
        $origin = $this->createLocation($merchant, 'Origin', true, -33.92, 18.42);
        $end = $this->createLocation($merchant, 'End', true, -33.95, 18.45);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $driver->id, 'vehicle_id' => $vehicle->id, 'origin_location_id' => $origin->id, 'destination_location_id' => $end->id, 'status' => 'draft', 'driver_workflow' => true]);
        $shipment = Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'merchant_order_ref' => 'PLANNED', 'status' => 'draft', 'pickup_location_id' => $origin->id, 'dropoff_location_id' => $end->id]);
        app(\App\Services\RunService::class)->attachShipments($run, [$shipment->uuid]);
        $service = app(AutoRunLifecycleService::class);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, Carbon::now(), null, null, 1000);
        $this->assertSame('draft', $run->fresh()->status);
        $this->assertDatabaseCount('runs', 1);
        $service->processVehiclePosition($vehicle, $merchant, -33.905, 18.405, Carbon::now()->addMinutes(10), null, null, 1005);
        $this->assertSame('in_progress', $run->fresh()->status);
        $this->assertSame('2026-09-16 08:10:00', $run->fresh()->started_at->toDateTimeString());
        $service->processVehiclePosition($vehicle, $merchant, -33.95, 18.45, Carbon::now()->addHour(), null, null, 1050);
        $this->assertSame('in_progress', $run->fresh()->status);
        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseCount('shipments', 1);
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

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-02-21 08:00:00'), null, null, 1000); // A enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:10:00'), null, null, 1005); // A exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9300, 18.4300, Carbon::parse('2026-02-21 08:20:00'), null, null, 1025); // B enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:30:00'), null, null, 1030); // B exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9300, 18.4300, Carbon::parse('2026-02-21 08:40:00'), null, null, 1032); // B re-enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-02-21 08:50:00'), null, null, 1035); // B exit
        $service->processVehiclePosition($vehicle, $merchant, -33.9400, 18.4400, Carbon::parse('2026-02-21 09:00:00'), null, null, 1050); // C enter
        $service->processVehiclePosition($vehicle, $merchant, -33.9500, 18.4500, Carbon::parse('2026-02-21 09:10:00'), null, null, 1100); // D enter

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
        $this->assertSame('delivered', $shipmentToC->status);
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
        $this->assertSame(1000, $bookingToB->odometer_at_request);
        $this->assertSame(1000, $bookingToB->odometer_at_collection);
        $this->assertSame(1030, $bookingToB->odometer_at_delivery);
        $this->assertSame('30.00', (string) $bookingToB->total_km_from_collection);
        $this->assertSame('delivered', $bookingToC->status);
        $this->assertNotNull($bookingToC->booked_at);
        $this->assertNotNull($bookingToC->collected_at);
        $this->assertNotNull($bookingToC->delivered_at);
        $this->assertSame(1000, $bookingToC->odometer_at_request);
        $this->assertSame(1000, $bookingToC->odometer_at_collection);
        $this->assertSame(1100, $bookingToC->odometer_at_delivery);
        $this->assertSame('100.00', (string) $bookingToC->total_km_from_collection);
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

    public function test_repeated_positions_during_a_delivery_visit_do_not_create_more_shipments(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $origin = $this->createLocation($merchant, 'Origin', true, -33.92, 18.42);
        $destination = $this->createLocation($merchant, 'Destination', false, -33.93, 18.43);
        $service = app(AutoRunLifecycleService::class);
        $at = Carbon::parse('2026-09-21 08:00:00');
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at);
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(10));
        $visit = VehicleActivity::where('location_id', $destination->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->sole();

        foreach ([11, 12, 30, 60] as $minutes) {
            $service->processVehiclePosition($vehicle, $merchant, -33.9301, 18.4301, $at->copy()->addMinutes($minutes));
        }

        $this->assertDatabaseCount('shipments', 1);
        $this->assertDatabaseCount('bookings', 1);
        $this->assertSame(1, VehicleActivity::where('event_type', VehicleActivity::EVENT_SHIPMENT_COLLECTION)->count());
        $this->assertSame(1, VehicleActivity::where('location_id', $destination->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->count());
        $this->assertNull($visit->fresh()->exited_at);
        $this->assertSame('in_transit', Shipment::sole()->status);
        $this->assertSame($origin->id, Shipment::sole()->pickup_location_id);
    }

    public function test_overlapping_locations_do_not_end_a_visit_until_the_truck_leaves_its_geofence(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $this->createLocation($merchant, 'Origin', true, -33.92, 18.42);
        $destination = $this->createLocation($merchant, 'Destination', false, -33.93, 18.43);
        // Centres are about 74 m apart, with overlapping drawn square polygons.
        $neighbour = $this->createLocation($merchant, 'Neighbour', false, -33.93, 18.4308);
        $service = app(AutoRunLifecycleService::class);
        $at = Carbon::parse('2026-09-21 08:00:00');
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at);
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(10));
        $visit = VehicleActivity::where('location_id', $destination->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->sole();

        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.4308, $at->copy()->addMinutes(11));
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(12));

        $this->assertDatabaseCount('shipments', 2);
        $this->assertDatabaseCount('bookings', 2);
        $this->assertNull($visit->fresh()->exited_at);
        $this->assertSame(2, Shipment::where('status', 'in_transit')->count());
        $this->assertSame(1, VehicleActivity::where('location_id', $neighbour->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->whereNull('exited_at')->count());
        $this->assertSame(2, VehicleActivity::where('event_type', VehicleActivity::EVENT_SHIPMENT_COLLECTION)->count());

        // Now outside the first fence but still inside the neighbour's fence.
        $exitAt = $at->copy()->addMinutes(20);
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.4316, $exitAt);
        $this->assertTrue($visit->fresh()->exited_at->equalTo($exitAt));
        $this->assertDatabaseCount('shipments', 2);
        $this->assertSame('delivered', Shipment::where('dropoff_location_id', $destination->id)->sole()->status);
        $this->assertSame('in_transit', Shipment::where('dropoff_location_id', $neighbour->id)->sole()->status);
    }

    public function test_three_nested_geofences_enter_and_exit_independently_without_duplicate_shipments(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $this->createLocation($merchant, 'Origin', true, -33.92, 18.42);
        $outer = $this->createLocation($merchant, 'Site', false, -33.93, 18.43);
        $inner = $this->createLocation($merchant, 'Warehouse', false, -33.93, 18.43);
        $inner->update(['polygon_bounds' => 'POLYGON((18.4295 -33.9305,18.4305 -33.9305,18.4305 -33.9295,18.4295 -33.9295,18.4295 -33.9305))']);
        $deep = $this->createLocation($merchant, 'Loading bay', false, -33.93, 18.43);
        $deep->update(['polygon_bounds' => 'POLYGON((18.4298 -33.9302,18.4302 -33.9302,18.4302 -33.9298,18.4298 -33.9298,18.4298 -33.9302))']);
        $service = app(AutoRunLifecycleService::class);
        $at = Carbon::parse('2026-09-22 08:00:00');
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at);
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.4308, $at->copy()->addMinutes(10));
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(11));
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(12));
        $this->assertDatabaseCount('shipments', 3);
        $this->assertDatabaseCount('bookings', 3);
        $this->assertSame(3, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->whereNull('exited_at')->count());
        $this->assertSame(3, VehicleActivity::where('event_type', VehicleActivity::EVENT_SHIPMENT_COLLECTION)->count());
        $service->processVehiclePosition($vehicle, $merchant, -33.93, 18.4308, $at->copy()->addMinutes(13));
        $this->assertSame('in_transit', Shipment::where('dropoff_location_id', $outer->id)->sole()->status);
        foreach ([$inner, $deep] as $location) {
            $this->assertSame('delivered', Shipment::where('dropoff_location_id', $location->id)->sole()->status);
            $visit = VehicleActivity::where('location_id', $location->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->sole();
            $this->assertTrue($visit->exited_at->equalTo($at->copy()->addMinutes(13)));
        }
        $this->assertTrue($service->processVehiclePosition($vehicle, $merchant, -33.93, 18.43, $at->copy()->addMinutes(14)));
        $this->assertSame(2, VehicleActivity::where('location_id', $inner->id)->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->count());
        $this->assertDatabaseCount('shipments', 3);
        $this->assertFalse($service->processVehiclePosition($vehicle, $merchant, -34, 19, $at->copy()->addMinutes(15)));
        $this->assertSame(0, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->whereNull('exited_at')->count());
    }

    public function test_simultaneous_collection_and_delivery_geofences_execute_in_priority_order(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        // Create delivery first to ensure ID ordering alone cannot make it miss the run.
        $delivery = $this->createLocation($merchant, 'Bay', false, -33.92, 18.42);
        $collection = $this->createLocation($merchant, 'Depot', true, -33.92, 18.42);
        $service = app(AutoRunLifecycleService::class);
        $at = Carbon::parse('2026-09-22 08:00:00');
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $at->copy()->addMinute());
        $this->assertDatabaseCount('runs', 1);
        $this->assertDatabaseCount('shipments', 1);
        $this->assertSame($collection->id, Run::sole()->origin_location_id);
        $this->assertSame($delivery->id, Shipment::sole()->dropoff_location_id);
        $this->assertSame(2, VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->whereNull('exited_at')->count());
    }

    public function test_internal_booking_backfill_keeps_collection_odometer_for_shipment_km(): void
    {
        $service = app(InternalBookingLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $pickup = $this->createLocation($merchant, 'Pickup', true, -33.9200, 18.4200);
        $dropoff = $this->createLocation($merchant, 'Dropoff', false, -33.9300, 18.4300);

        $run = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'status' => Run::STATUS_COMPLETED,
            'auto_created' => true,
            'started_at' => '2026-02-21 08:00:00',
            'completed_at' => '2026-02-21 09:00:00',
            'odometer_start_km' => 1000,
            'odometer_end_km' => 1045,
            'origin_location_id' => $pickup->id,
            'destination_location_id' => $dropoff->id,
        ]);
        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'AUTO-BACKFILL-KM',
            'status' => 'delivered',
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'auto_created' => true,
        ]);
        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_DONE,
        ]);

        $booking = $service->ensureBookingForShipment($shipment, $run, $shipment->created_at, 1000, 1000);
        $this->assertSame(1000, $booking->odometer_at_collection);

        $booking = $service->markShipmentDelivered($shipment, Carbon::parse('2026-02-21 09:00:00'), 1045);
        $this->assertSame(1000, $booking?->odometer_at_collection);
        $this->assertSame(1045, $booking?->odometer_at_delivery);
        $this->assertSame('45.00', (string) $booking?->total_km_from_collection);
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

        $driverUser = $this->createUserWithoutEvents(['role' => 'driver']);
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

        $wrongDriverUser = $this->createUserWithoutEvents(['role' => 'driver']);
        $wrongDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $wrongDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $wrongDriverUser->id,
            'intergration_id' => 'drv-123',
            'is_active' => true,
        ]);

        $correctDriverUser = $this->createUserWithoutEvents(['role' => 'driver']);
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
            'polygon_bounds' => $this->squareGeofence(-33.9600, 18.4600),
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

    public function test_it_reuses_a_run_when_the_truck_returns_to_its_origin_with_shipments(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $origin = $this->createLocation($merchant, 'Collection A', true, -33.9200, 18.4200);
        $dropoff = $this->createLocation($merchant, 'Delivery B', false, -33.9500, 18.4500);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-04 10:00:00'));
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-03-04 10:10:00'));

        $run = Run::query()->where('merchant_id', $merchant->id)->firstOrFail();
        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'RETURN-TO-ORIGIN',
            'status' => 'in_transit',
            'pickup_location_id' => $origin->id,
            'dropoff_location_id' => $dropoff->id,
            'auto_created' => true,
        ]);
        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-04 10:20:00'));

        $this->assertDatabaseCount('runs', 1);
        $run->refresh();
        $this->assertSame(Run::STATUS_IN_PROGRESS, $run->status);
        $this->assertSame($origin->id, $run->origin_location_id);
        $this->assertNull($run->destination_location_id);
        $this->assertNull($run->completed_at);
        $this->assertDatabaseMissing('vehicle_activity', [
            'run_id' => $run->id,
            'event_type' => VehicleActivity::EVENT_RUN_ENDED,
        ]);
    }

    public function test_it_does_not_create_or_deliver_a_shipment_to_its_pickup_location(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $type = LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'slug' => 'collection-and-delivery',
            'title' => 'Collection and Delivery',
            'collection_point' => true,
            'delivery_point' => true,
            'sequence' => 10,
            'default' => false,
        ]);
        $location = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Combined Depot',
            'address_line_1' => '1 Combined Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => -33.9200,
            'longitude' => 18.4200,
            'polygon_bounds' => $this->squareGeofence(-33.9200, 18.4200),
            'location_type_id' => $type->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-04 11:00:00'));

        $run = Run::query()->where('merchant_id', $merchant->id)->firstOrFail();
        $this->assertDatabaseCount('shipments', 0);
        $this->assertSame($location->id, $run->origin_location_id);
        $this->assertNull($run->destination_location_id);

        $invalidShipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'INVALID-SAME-LOCATION',
            'status' => 'in_transit',
            'pickup_location_id' => $location->id,
            'dropoff_location_id' => $location->id,
            'auto_created' => true,
            'metadata' => ['unchanged' => true],
        ]);
        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $invalidShipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);
        VehicleActivity::query()
            ->where('vehicle_id', $vehicle->id)
            ->where('location_id', $location->id)
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->latest('id')
            ->firstOrFail()
            ->forceFill(['shipment_id' => $invalidShipment->id])
            ->save();

        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-03-04 11:10:00'));

        $invalidShipment->refresh();
        $this->assertSame('in_transit', $invalidShipment->status);
        $this->assertSame(['unchanged' => true], $invalidShipment->metadata);
        $this->assertDatabaseMissing('vehicle_activity', [
            'shipment_id' => $invalidShipment->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_ENDED,
        ]);
        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $run->id,
            'shipment_id' => $invalidShipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);
    }

    public function test_it_delivers_a_qualifying_shipment_on_exit_for_the_same_vehicle_run(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);

        $origin = $this->createLocation($merchant, 'Collection A', true, -33.9200, 18.4200);
        $dropoff = $this->createLocation($merchant, 'Delivery B', false, -33.9500, 18.4500);

        $service->processVehiclePosition($vehicle, $merchant, -33.9200, 18.4200, Carbon::parse('2026-03-04 12:00:00'), null, null, 1000);
        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-03-04 12:10:00'), null, null, 1005);
        $service->processVehiclePosition($vehicle, $merchant, -33.9500, 18.4500, Carbon::parse('2026-03-04 12:20:00'), null, null, 1010);

        $run = Run::query()->where('vehicle_id', $vehicle->id)->firstOrFail();
        $shipment = Shipment::query()->where('dropoff_location_id', $dropoff->id)->firstOrFail();
        $booking = Booking::query()->where('shipment_id', $shipment->id)->firstOrFail();

        $otherVehicle = Vehicle::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'plate_number' => 'OTHER-VEHICLE',
            'is_active' => true,
        ]);
        $otherRun = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $otherVehicle->id,
            'status' => Run::STATUS_IN_PROGRESS,
            'origin_location_id' => $origin->id,
            'started_at' => Carbon::parse('2026-03-04 11:00:00'),
        ]);
        $otherShipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'OTHER-VEHICLE-SHIPMENT',
            'status' => 'in_transit',
            'pickup_location_id' => $origin->id,
            'dropoff_location_id' => $dropoff->id,
            'auto_created' => true,
        ]);
        RunShipment::create([
            'run_id' => $otherRun->id,
            'shipment_id' => $otherShipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);

        $this->assertDatabaseMissing('vehicle_activity', [
            'shipment_id' => $shipment->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ]);

        $service->processVehiclePosition($vehicle, $merchant, -33.9050, 18.4050, Carbon::parse('2026-03-04 12:30:00'), null, null, 1015);

        $shipment->refresh();
        $booking->refresh();
        $this->assertSame('delivered', $shipment->status);
        $this->assertSame('delivered', $booking->status);
        $this->assertNotNull($booking->delivered_at);
        $this->assertSame(1015, $booking->odometer_at_delivery);
        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_DONE,
        ]);
        $this->assertDatabaseHas('vehicle_activity', [
            'vehicle_id' => $vehicle->id,
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'location_id' => $dropoff->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ]);
        $this->assertDatabaseHas('vehicle_activity', [
            'shipment_id' => $shipment->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_ENDED,
        ]);
        $otherShipment->refresh();
        $this->assertSame('in_transit', $otherShipment->status);
        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $otherRun->id,
            'shipment_id' => $otherShipment->id,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);
    }

    public function test_it_delivers_the_shipment_from_the_completed_run_when_entry_starts_a_new_run(): void
    {
        $service = app(AutoRunLifecycleService::class);
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $origin = $this->createLocation($merchant, 'Origin', true, -33.9200, 18.4200);

        $combinedType = LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'slug' => 'combined-sequenced',
            'title' => 'Combined Sequenced',
            'collection_point' => true,
            'delivery_point' => true,
            'sequence' => 20,
            'default' => false,
        ]);
        $destination = Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => 'Truckwash',
            'address_line_1' => '1 Wash Road',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'latitude' => -33.9500,
            'longitude' => 18.4500,
            'polygon_bounds' => $this->squareGeofence(-33.9500, 18.4500),
            'location_type_id' => $combinedType->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);
        $merchant->forceFill([
            'location_automation_settings' => [
                'location_types' => [[
                    'location_type_id' => $combinedType->uuid,
                    'entry' => [
                        ['id' => 'create-first', 'action' => 'create_shipment', 'conditions' => []],
                        ['id' => 'start-second', 'action' => 'start_run', 'conditions' => []],
                    ],
                    'exit' => [['id' => 'record-exit', 'action' => 'record_vehicle_exit', 'conditions' => []]],
                ]],
            ],
        ])->save();

        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9200, 18.4200, Carbon::parse('2026-03-04 13:00:00'));
        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9050, 18.4050, Carbon::parse('2026-03-04 13:10:00'));
        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9500, 18.4500, Carbon::parse('2026-03-04 13:20:00'));

        $shipment = Shipment::query()->where('dropoff_location_id', $destination->id)->firstOrFail();
        $shipmentRun = $shipment->runs()->firstOrFail();
        $activeRun = Run::query()->where('vehicle_id', $vehicle->id)->where('status', Run::STATUS_IN_PROGRESS)->firstOrFail();
        $this->assertNotSame($shipmentRun->id, $activeRun->id);
        $this->assertSame(Run::STATUS_COMPLETED, $shipmentRun->status);
        $this->assertSame($origin->id, $shipment->pickup_location_id);

        $service->processVehiclePosition($vehicle, $merchant->fresh(), -33.9050, 18.4050, Carbon::parse('2026-03-04 13:30:00'));

        $shipment->refresh();
        $this->assertSame('delivered', $shipment->status);
        $this->assertDatabaseHas('vehicle_activity', [
            'vehicle_id' => $vehicle->id,
            'run_id' => $shipmentRun->id,
            'shipment_id' => $shipment->id,
            'location_id' => $destination->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
        ]);
        $this->assertDatabaseHas('run_shipments', [
            'run_id' => $shipmentRun->id,
            'shipment_id' => $shipment->id,
            'status' => RunShipment::STATUS_DONE,
        ]);
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

        $driverUser = $this->createUserWithoutEvents(['role' => 'driver']);
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

        $wrongDriverUser = $this->createUserWithoutEvents(['role' => 'driver']);
        $wrongDriverUser->forceFill(['account_id' => $merchant->account_id])->save();
        $wrongDriver = Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $otherMerchant->id,
            'user_id' => $wrongDriverUser->id,
            'intergration_id' => 'drv-live',
            'is_active' => true,
        ]);

        $correctDriverUser = $this->createUserWithoutEvents(['role' => 'driver']);
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

        $driverUserA = $this->createUserWithoutEvents(['role' => 'driver']);
        $driverUserA->forceFill(['account_id' => $merchant->account_id])->save();
        $driverA = Driver::create([
            'account_id' => $merchant->account_id,
            'user_id' => $driverUserA->id,
            'intergration_id' => 'drv-a',
            'is_active' => true,
        ]);

        $driverUserB = $this->createUserWithoutEvents(['role' => 'driver']);
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

        $driverUser = $this->createUserWithoutEvents(['role' => 'driver']);
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

    public function test_visit_costs_cover_origin_intermediate_delivery_and_arriving_run_boundary(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(true);
        $origin = $this->createLocation($merchant, 'Origin', true, -33.92, 18.42);
        $stop = $this->createLocation($merchant, 'Intermediate', false, -33.93, 18.43);
        $stop->update(['location_type_id' => null]);
        $delivery = $this->createLocation($merchant, 'Delivery', false, -33.94, 18.44);
        $next = $this->createLocation($merchant, 'Next origin', true, -33.95, 18.45);
        foreach ([$origin, $stop, $delivery, $next] as $location) {
            $location->additionalCosts()->create(['title' => $location->name, 'amount' => '10.00', 'currency' => 'ZAR']);
        }
        $service = app(AutoRunLifecycleService::class);
        foreach ([$origin, $stop, $delivery, $next] as $index => $location) {
            $service->processVehiclePosition($vehicle, $merchant, (float) $location->latitude, (float) $location->longitude, Carbon::parse('2026-09-15 08:00:00')->addMinutes($index * 20));
        }
        $runs = Run::orderBy('id')->get();
        $this->assertCount(2, $runs);
        $this->assertCount(4, $runs[0]->additionalCosts);
        $this->assertSame(Run::STATUS_COMPLETED, $runs[0]->status);
        $this->assertCount(0, $runs[1]->additionalCosts);
        $this->assertSame([$origin->name, $stop->name, $delivery->name, $next->name], $runs[0]->additionalCosts->pluck('title')->all());
    }

    public function test_costs_charge_once_per_visit_without_auto_shipments_and_preserve_deleted_replay_keys(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);
        $location = $this->createLocation($merchant, 'Toll', false, -33.92, 18.42);
        foreach (['Toll', 'Handling'] as $title) {
            $location->additionalCosts()->create(['title' => $title, 'amount' => '12.50', 'currency' => 'ZAR']);
        }
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'status' => Run::STATUS_IN_PROGRESS]);
        $service = app(AutoRunLifecycleService::class);
        $time = Carbon::parse('2026-09-15 08:00:00');
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $time);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $time->copy()->addMinute());
        $this->assertCount(2, $run->additionalCosts()->get());
        $visit = VehicleActivity::where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->firstOrFail();
        app(\App\Services\RunCostService::class)->applyVisit($run, $location, $visit);
        $this->assertCount(2, $run->additionalCosts()->get());
        $run->additionalCosts()->first()->delete();
        app(\App\Services\RunCostService::class)->applyVisit($run, $location, $visit);
        $this->assertCount(1, $run->additionalCosts()->get());
        $this->assertSame(2, \App\Models\RunCost::withTrashed()->count());
        $service->processVehiclePosition($vehicle, $merchant, -34.00, 18.60, $time->copy()->addMinutes(2));
        $location->additionalCosts()->update(['amount' => '20.00']);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42, $time->copy()->addMinutes(3));
        $this->assertCount(3, $run->additionalCosts()->get());
        $this->assertSame(['12.5000', '20.0000', '20.0000'], $run->additionalCosts()->pluck('amount')->all());
    }

    public function test_visits_without_an_in_progress_run_do_not_receive_costs_or_backfill(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);
        $location = $this->createLocation($merchant, 'Toll', false, -33.92, 18.42);
        $location->additionalCosts()->create(['title' => 'Toll', 'amount' => '10.00', 'currency' => 'ZAR']);
        $service = app(AutoRunLifecycleService::class);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42);
        $this->assertDatabaseCount('run_costs', 0);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'status' => Run::STATUS_DRAFT]);
        $service->processVehiclePosition($vehicle, $merchant, -34.00, 18.60);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42);
        $this->assertDatabaseCount('run_costs', 0);
        $run->update(['status' => Run::STATUS_IN_PROGRESS]);
        $service->processVehiclePosition($vehicle, $merchant, -33.92, 18.42);
        $this->assertDatabaseCount('run_costs', 0);
    }

    public function test_database_rejects_duplicate_automatic_cost_even_after_soft_deletion(): void
    {
        [$merchant, $vehicle] = $this->createMerchantVehicleContext(false);
        $location = $this->createLocation($merchant, 'Toll', false, -33.92, 18.42);
        $location->additionalCosts()->create(['title' => 'Toll', 'amount' => '10.00', 'currency' => 'ZAR']);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'status' => Run::STATUS_IN_PROGRESS]);
        app(AutoRunLifecycleService::class)->processVehiclePosition($vehicle, $merchant, -33.92, 18.42);
        $cost = $run->additionalCosts()->firstOrFail();
        $duplicate = $cost->replicate(['uuid']);
        $cost->delete();
        $this->expectException(\Illuminate\Database\UniqueConstraintViolationException::class);
        $duplicate->save();
    }

    private function createMerchantVehicleContext(bool $allowAutoCreation): array
    {
        $user = $this->createUserWithoutEvents(['role' => 'user']);

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
            'polygon_bounds' => $this->squareGeofence($lat, $lng),
            'location_type_id' => $type->id,
            'metadata' => ['geofence_radius_meters' => 120],
        ]);
    }

    private function createUserWithoutEvents(array $attributes = []): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            ...$attributes,
        ]));
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
