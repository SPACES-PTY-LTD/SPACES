<?php

namespace Tests\Feature;

use App\Jobs\ProcessCarrierWebhookJob;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\TrackingEvent;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarrierWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_carrier_webhook_creates_tracking_event(): void
    {
        $merchant = Merchant::factory()->create();
        $shipment = Shipment::create([
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-TRACK',
            'status' => 'draft',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
        ]);

        ProcessCarrierWebhookJob::dispatchSync('dummy', [
            'shipment_uuid' => $shipment->uuid,
            'event_code' => 'picked_up',
            'event_description' => 'Picked up',
        ]);

        $this->assertTrue(TrackingEvent::where('shipment_id', $shipment->id)->exists());
    }
}
