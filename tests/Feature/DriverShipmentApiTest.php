<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\Booking;
use App\Models\BookingPod;
use App\Models\CancelReason;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Quote;
use App\Models\QuoteOption;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverShipmentApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_list_shipments_returns_only_active_run_assignments_for_authenticated_driver(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);

        $visibleShipment = $this->createShipment($merchant, 'ORDER-DRIVER-1', 'booked');
        $this->createBooking($merchant, $visibleShipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $visibleShipment, Run::STATUS_IN_PROGRESS);

        $completedShipment = $this->createShipment($merchant, 'ORDER-DRIVER-2', 'booked');
        $this->createBooking($merchant, $completedShipment, 'internal', 'delivered');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $completedShipment, Run::STATUS_COMPLETED);

        [$otherDriverUser] = $this->createDriverContext($merchant, 'other-driver@example.com');
        $otherDriver = $otherDriverUser->driver;
        $otherShipment = $this->createShipment($merchant, 'ORDER-DRIVER-3', 'booked');
        $this->createBooking($merchant, $otherShipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $otherDriver, $vehicle, $otherShipment, Run::STATUS_IN_PROGRESS);

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->getJson('/api/v1/driver/shipments');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.shipment_id', $visibleShipment->uuid)
            ->assertJsonPath('data.0.booking.booking_id', $visibleShipment->booking->uuid)
            ->assertJsonMissing(['shipment_id' => $completedShipment->uuid])
            ->assertJsonMissing(['shipment_id' => $otherShipment->uuid]);
    }

    public function test_show_returns_shipment_shaped_payload_with_nested_booking(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SHOW-1', 'booked');
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $pod = BookingPod::create([
            'account_id' => $merchant->account_id,
            'booking_id' => $booking->id,
            'file_key' => 'pods/show-1.jpg',
            'file_type' => 'image/jpeg',
            'signed_by' => 'Receiver',
            'captured_by_user_id' => $driverUser->id,
        ]);
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_DISPATCHED);

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->getJson("/api/v1/driver/shipments/{$shipment->uuid}");

        $response->assertOk()
            ->assertJsonPath('data.shipment_id', $shipment->uuid)
            ->assertJsonPath('data.booking.booking_id', $booking->uuid)
            ->assertJsonPath('data.booking.pod.pod_id', $pod->uuid)
            ->assertJsonPath('data.booking.carrier_code', 'internal')
            ->assertJsonPath('data.run_status', Run::STATUS_DISPATCHED);
    }

    public function test_show_returns_not_found_for_unassigned_shipment(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $shipment = $this->createShipment($merchant, 'ORDER-MISSING-1', 'booked');

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->getJson("/api/v1/driver/shipments/{$shipment->uuid}")
            ->assertNotFound();
    }

    public function test_update_status_updates_booking_and_shipment_by_shipment_uuid(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-STATUS-1', 'in_transit');
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
            'status' => 'delivered',
            'note' => 'Delivered to receiver',
            'odometer_at_collection' => 1200,
            'odometer_at_delivery' => 1245,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.shipment_id', $shipment->uuid)
            ->assertJsonPath('data.status', 'delivered')
            ->assertJsonPath('data.booking.booking_id', $booking->uuid)
            ->assertJsonPath('data.booking.status', 'delivered');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'delivered',
            'odometer_at_collection' => 1200,
            'odometer_at_delivery' => 1245,
            'total_km_from_collection' => 45,
        ]);
        $this->assertDatabaseHas('shipments', [
            'id' => $shipment->id,
            'status' => 'delivered',
        ]);
        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipment->id,
            'booking_id' => $booking->id,
            'event_code' => 'delivered',
        ]);
        $this->assertDatabaseHas('vehicles', [
            'id' => $vehicle->id,
            'odometer' => 1245,
        ]);
    }

    public function test_update_status_requires_delivery_odometer_for_delivered_status(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-STATUS-ODO-1', 'in_transit');
        $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $this->withHeaders($this->driverAuthHeaders($driverUser))->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
            'status' => 'delivered',
            'odometer_at_collection' => 1200,
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ODOMETER_REQUIRED');
    }

    public function test_update_status_does_not_decrease_vehicle_odometer(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver, 2000);
        $shipment = $this->createShipment($merchant, 'ORDER-STATUS-ODO-2', 'in_transit');
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $this->withHeaders($this->driverAuthHeaders($driverUser))->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
            'status' => 'delivered',
            'odometer_at_collection' => 1100,
            'odometer_at_delivery' => 1200,
        ])->assertOk();

        $vehicle->refresh();
        $booking->refresh();

        $this->assertSame(2000, $vehicle->odometer);
        $this->assertSame(1100, $booking->odometer_at_collection);
        $this->assertSame(1200, $booking->odometer_at_delivery);
    }

    public function test_update_status_rejects_backward_transition(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-STATUS-2', 'in_transit');
        $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
                'status' => 'booked',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_STATUS');
    }

    public function test_update_status_rejects_non_internal_carrier(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-STATUS-3', 'in_transit');
        $this->createBooking($merchant, $shipment, 'external-carrier', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
                'status' => 'delivered',
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_CARRIER');
    }

    public function test_scan_records_single_parcel_without_promoting_until_all_parcels_are_scanned(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-1', 'booked', 2);
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $parcel = $shipment->parcels()->orderBy('id')->firstOrFail();

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
            'parcel_code' => $parcel->parcel_code,
            'event_description' => 'Parcel scanned at pickup',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.booking.status', 'booked')
            ->assertJsonPath('data.status', 'booked')
            ->assertJsonPath('data.scanned_parcel_count', 1)
            ->assertJsonPath('data.total_parcel_count', 2)
            ->assertJsonPath('meta.scan_status', 'scanned');

        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipment->id,
            'booking_id' => $booking->id,
            'event_code' => 'parcel_scanned',
        ]);
        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'booked',
        ]);
    }

    public function test_scan_moves_booking_and_shipment_to_in_transit_when_all_parcels_are_scanned(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-2', 'booked', 1);
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $parcel = $shipment->parcels()->firstOrFail();

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
            'parcel_code' => $parcel->parcel_code,
            'odometer_at_collection' => 1500,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.booking.status', 'in_transit')
            ->assertJsonPath('data.status', 'in_transit')
            ->assertJsonPath('meta.scan_status', 'completed')
            ->assertJsonPath('meta.all_parcels_scanned', true);

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'in_transit',
            'odometer_at_collection' => 1500,
        ]);
        $this->assertDatabaseHas('vehicles', [
            'id' => $vehicle->id,
            'odometer' => 1500,
        ]);
        $this->assertDatabaseHas('shipments', [
            'id' => $shipment->id,
            'status' => 'in_transit',
        ]);
        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipment->id,
            'booking_id' => $booking->id,
            'event_code' => 'picked_up',
        ]);
        $this->assertDatabaseHas('tracking_events', [
            'shipment_id' => $shipment->id,
            'booking_id' => $booking->id,
            'event_code' => 'in_transit',
        ]);
    }

    public function test_scan_requires_pickup_odometer_when_final_parcel_completes_pickup(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-ODO-1', 'booked', 1);
        $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $parcel = $shipment->parcels()->firstOrFail();

        $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
            'parcel_code' => $parcel->parcel_code,
        ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ODOMETER_REQUIRED');

        $this->assertNull($parcel->fresh()->picked_up_scanned_at);
    }

    public function test_scan_rejects_parcel_code_from_another_shipment(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-3', 'booked', 1);
        $otherShipment = $this->createShipment($merchant, 'ORDER-SCAN-4', 'booked', 1);
        $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $foreignParcel = $otherShipment->parcels()->firstOrFail();

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
                'parcel_code' => $foreignParcel->parcel_code,
            ])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INVALID_PARCEL');
    }

    public function test_scan_ignores_duplicate_parcel_scan(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-5', 'booked', 1);
        $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $parcel = $shipment->parcels()->firstOrFail();

        $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
            'parcel_code' => $parcel->parcel_code,
            'odometer_at_collection' => 1750,
        ])->assertOk();

        $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/scan", [
            'parcel_code' => $parcel->parcel_code,
        ])
            ->assertOk()
            ->assertJsonPath('meta.scan_status', 'already_scanned');

        $this->assertSame(1, $shipment->trackingEvents()->where('event_code', 'parcel_scanned')->count());
        $this->assertDatabaseHas('shipment_parcels', [
            'id' => $parcel->id,
        ]);
    }

    public function test_shipment_response_includes_parcel_scan_progress(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-SCAN-6', 'booked', 2);
        $this->createBooking($merchant, $shipment, 'internal', 'booked');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $parcel = $shipment->parcels()->orderBy('id')->firstOrFail();
        $parcel->update([
            'picked_up_scanned_at' => now(),
            'picked_up_scanned_by_user_id' => $driverUser->id,
        ]);

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->getJson("/api/v1/driver/shipments/{$shipment->uuid}")
            ->assertOk()
            ->assertJsonPath('data.scanned_parcel_count', 1)
            ->assertJsonPath('data.total_parcel_count', 2)
            ->assertJsonPath('data.all_parcels_scanned', false)
            ->assertJsonPath('data.parcels.0.parcel_code', $parcel->parcel_code)
            ->assertJsonPath('data.parcels.0.is_picked_up_scanned', true);
    }

    public function test_pod_stores_pod_against_booking_and_returns_nested_payload(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-POD-1', 'in_transit');
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/pod", [
            'file_key' => 'pods/pod-1.jpg',
            'file_type' => 'image/jpeg',
            'signed_by' => 'Jane Receiver',
            'odometer_at_delivery' => 1900,
        ]);

        $response->assertOk()
            ->assertJsonPath('data.booking.booking_id', $booking->uuid)
            ->assertJsonPath('data.booking.pod.file_key', 'pods/pod-1.jpg')
            ->assertJsonPath('data.booking.pod.signed_by', 'Jane Receiver')
            ->assertJsonPath('data.booking.odometer_at_delivery', 1900);

        $this->assertDatabaseHas('booking_pods', [
            'booking_id' => $booking->id,
            'file_key' => 'pods/pod-1.jpg',
        ]);
    }

    public function test_cancel_updates_booking_and_shipment(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-CANCEL-1', 'in_transit');
        $booking = $this->createBooking($merchant, $shipment, 'internal', 'in_transit');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_IN_PROGRESS);
        $this->createCancelReason('customer_unavailable', 'Customer unavailable');

        $response = $this->withHeaders($this->driverAuthHeaders($driverUser))->postJson("/api/v1/driver/shipments/{$shipment->uuid}/cancel", [
            'reason_code' => 'customer_unavailable',
            'note' => 'No one on site',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.booking.status', 'cancelled')
            ->assertJsonPath('data.booking.cancellation_reason_code', 'customer_unavailable');

        $this->assertDatabaseHas('bookings', [
            'id' => $booking->id,
            'status' => 'cancelled',
            'cancellation_reason_code' => 'customer_unavailable',
        ]);
        $this->assertDatabaseHas('shipments', [
            'id' => $shipment->id,
            'status' => 'cancelled',
        ]);
    }

    public function test_driver_endpoints_return_forbidden_without_driver_profile(): void
    {
        $user = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'role' => 'driver',
        ]));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $this->withHeaders($this->driverAuthHeaders($user))
            ->getJson('/api/v1/driver/shipments')
            ->assertForbidden()
            ->assertJsonPath('error.code', 'FORBIDDEN');
    }

    public function test_mutation_endpoint_returns_not_found_when_shipment_has_no_booking(): void
    {
        [$driverUser, $merchant] = $this->createDriverContext();
        $driver = $driverUser->driver;
        $vehicle = $this->createVehicle($merchant, $driver);
        $shipment = $this->createShipment($merchant, 'ORDER-NO-BOOKING-1', 'draft');
        $this->attachShipmentToRun($merchant, $driver, $vehicle, $shipment, Run::STATUS_DRAFT);

        $this->withHeaders($this->driverAuthHeaders($driverUser))
            ->patchJson("/api/v1/driver/shipments/{$shipment->uuid}/status", [
                'status' => 'in_transit',
            ])
            ->assertNotFound();
    }

    private function createDriverContext(?Merchant $merchant = null, ?string $email = null): array
    {
        if (!$merchant) {
            $owner = User::withoutEvents(fn () => User::factory()->create([
                'uuid' => (string) Str::uuid(),
                'email' => fake()->unique()->safeEmail(),
                'role' => 'user',
            ]));

            $account = Account::create(['owner_user_id' => $owner->id]);
            $owner->forceFill(['account_id' => $account->id])->save();

            $merchant = Merchant::create([
                'account_id' => $account->id,
                'owner_user_id' => $owner->id,
                'name' => fake()->company(),
                'legal_name' => fake()->company().' LLC',
                'status' => 'active',
                'billing_email' => fake()->safeEmail(),
                'default_webhook_url' => fake()->url(),
                'timezone' => 'UTC',
                'operating_countries' => ['US'],
            ]);
            $merchant->users()->attach($owner->id, ['role' => 'owner']);
        }

        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
        ]));

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $driverUser->id,
            'is_active' => true,
        ]);

        return [$driverUser->fresh('driver'), $merchant];
    }

    private function driverAuthHeaders(User $user): array
    {
        return [
            'Authorization' => 'Bearer '.$user->createToken('driver-test')->plainTextToken,
        ];
    }

    private function createVehicle(Merchant $merchant, Driver $driver, ?int $odometer = null): Vehicle
    {
        return Vehicle::create([
            'account_id' => $merchant->account_id,
            'plate_number' => strtoupper(fake()->bothify('??-####')),
            'odometer' => $odometer,
            'last_driver_id' => $driver->id,
            'is_active' => true,
        ]);
    }

    private function createShipment(Merchant $merchant, string $orderRef, string $status, int $parcelCount = 1): Shipment
    {
        $pickup = $this->createLocation($merchant, 'Pickup '.$orderRef);
        $dropoff = $this->createLocation($merchant, 'Dropoff '.$orderRef);

        $shipmentStatus = in_array($status, ['draft', 'quoted', 'booked', 'cancelled', 'delivered', 'failed'], true)
            ? $status
            : 'booked';

        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => $orderRef,
            'status' => $shipmentStatus,
            'pickup_location_id' => $pickup->id,
            'dropoff_location_id' => $dropoff->id,
            'ready_at' => now()->addHour(),
        ]);

        for ($index = 0; $index < $parcelCount; $index++) {
            $weightColumn = Schema::hasColumn('shipment_parcels', 'weight') ? 'weight' : 'weight_kg';
            $shipment->parcels()->create([
                'account_id' => $merchant->account_id,
                'parcel_code' => strtoupper(Str::random(10)),
                $weightColumn => 1.5,
                'weight_measurement' => 'kg',
                'type' => 'box',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
                'contents_description' => 'Parcel '.($index + 1),
            ]);
        }

        return $shipment->fresh('parcels');
    }

    private function createLocation(Merchant $merchant, string $name): Location
    {
        return Location::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'name' => $name,
            'company' => $merchant->name,
            'address_line_1' => '123 Main St',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
            'post_code' => '8001',
            'country' => 'ZA',
        ]);
    }

    private function createBooking(Merchant $merchant, Shipment $shipment, string $carrierCode, string $status): Booking
    {
        $carrier = Carrier::firstOrCreate(
            ['code' => $carrierCode],
            ['name' => strtoupper($carrierCode), 'type' => $carrierCode === 'internal' ? 'internal' : 'external', 'enabled' => true]
        );

        $quote = Quote::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'shipment_id' => $shipment->id,
            'status' => 'created',
            'requested_at' => now(),
        ]);

        $quoteOption = QuoteOption::create([
            'account_id' => $merchant->account_id,
            'quote_id' => $quote->id,
            'carrier_code' => $carrier->code,
            'service_code' => 'standard',
            'currency' => 'USD',
            'amount' => 100,
            'total_amount' => 100,
        ]);

        return Booking::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'shipment_id' => $shipment->id,
            'quote_option_id' => $quoteOption->id,
            'current_driver_id' => $shipment->currentRunShipment?->run?->driver_id,
            'status' => $status,
            'carrier_code' => $carrier->code,
            'carrier_job_id' => 'JOB-'.fake()->numerify('####'),
            'label_url' => 'https://example.com/label.pdf',
            'booked_at' => now()->subHour(),
        ]);
    }

    private function attachShipmentToRun(Merchant $merchant, Driver $driver, Vehicle $vehicle, Shipment $shipment, string $runStatus): void
    {
        $run = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
            'status' => $runStatus,
        ]);

        RunShipment::create([
            'run_id' => $run->id,
            'shipment_id' => $shipment->id,
            'sequence' => 1,
            'status' => RunShipment::STATUS_ACTIVE,
        ]);
    }

    private function createCancelReason(string $code, string $title): CancelReason
    {
        return CancelReason::create([
            'code' => $code,
            'title' => $title,
            'enabled' => true,
        ]);
    }
}
