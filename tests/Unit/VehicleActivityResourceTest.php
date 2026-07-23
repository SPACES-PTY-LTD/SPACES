<?php

namespace Tests\Unit;

use App\Http\Resources\VehicleActivityResource;
use App\Models\Booking;
use App\Models\Location;
use App\Models\Shipment;
use App\Models\VehicleActivity;
use Illuminate\Http\Request;
use Tests\TestCase;

class VehicleActivityResourceTest extends TestCase
{
    public function test_shipment_summary_includes_pickup_and_dropoff_locations(): void
    {
        $pickup = new Location([
            'uuid' => 'pickup-uuid',
            'name' => 'Origin Depot',
            'code' => 'ORIGIN',
        ]);
        $dropoff = new Location([
            'uuid' => 'dropoff-uuid',
            'name' => 'Destination Store',
            'code' => 'DEST',
        ]);
        $shipment = new Shipment([
            'uuid' => 'shipment-uuid',
            'merchant_order_ref' => 'ORDER-100',
            'status' => 'draft',
        ]);
        $shipment->setRelation('pickupLocation', $pickup);
        $shipment->setRelation('dropoffLocation', $dropoff);
        $shipment->forceFill(['created_at' => '2026-07-23 10:00:00']);
        $shipment->setRelation('booking', new Booking(['delivered_at' => '2026-07-23 12:30:00']));

        $activity = new VehicleActivity(['uuid' => 'activity-uuid']);
        $activity->setRelation('merchant', null);
        $activity->setRelation('vehicle', null);
        $activity->setRelation('location', null);
        $activity->setRelation('run', null);
        $activity->setRelation('shipment', $shipment);

        $payload = (new VehicleActivityResource($activity))->toArray(Request::create('/'));

        $this->assertSame('pickup-uuid', $payload['shipment']['pickup_location']['location_id']);
        $this->assertSame('Origin Depot', $payload['shipment']['pickup_location']['name']);
        $this->assertSame('dropoff-uuid', $payload['shipment']['dropoff_location']['location_id']);
        $this->assertSame('Destination Store', $payload['shipment']['dropoff_location']['name']);
        $this->assertSame('2026-07-23T10:00:00+00:00', $payload['shipment']['created_at']);
        $this->assertSame('2026-07-23T12:30:00+00:00', $payload['shipment']['delivered_at']);
    }
}
