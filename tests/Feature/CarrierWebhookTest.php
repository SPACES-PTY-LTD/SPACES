<?php

namespace Tests\Feature;

use App\Jobs\ProcessCarrierWebhookJob;
use App\Models\Booking;
use App\Models\Merchant;
use App\Models\Quote;
use App\Models\QuoteOption;
use App\Models\Shipment;
use App\Models\TrackingEvent;
use App\Services\WebhookService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Mockery\MockInterface;
use Tests\TestCase;

class CarrierWebhookTest extends TestCase
{
    use RefreshDatabase;

    public function test_carrier_webhook_creates_tracking_event(): void
    {
        $merchant = Merchant::factory()->create();
        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-TRACK',
            'status' => 'draft',
        ]);

        ProcessCarrierWebhookJob::dispatchSync('dummy', [
            'shipment_uuid' => $shipment->uuid,
            'event_code' => 'picked_up',
            'event_description' => 'Picked up',
        ]);

        $this->assertTrue(TrackingEvent::where('shipment_id', $shipment->id)->exists());
    }

    public function test_tracking_updated_payload_uses_uuid_identifiers_without_booking(): void
    {
        $merchant = Merchant::factory()->create();
        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-TRACK-UUID-1',
            'status' => 'draft',
        ]);

        $job = new ProcessCarrierWebhookJob('dummy', [
            'shipment_uuid' => $shipment->uuid,
            'event_code' => 'in_transit',
            'event_description' => 'In transit',
        ]);

        $webhookService = $this->mock(WebhookService::class, function (MockInterface $mock) use ($merchant, $shipment): void {
            $mock->shouldReceive('fanout')
                ->once()
                ->withArgs(function ($fanoutMerchant, string $eventType, array $payload) use ($merchant, $shipment): bool {
                    $this->assertEquals($merchant->id, $fanoutMerchant->id);
                    $this->assertSame('tracking.updated', $eventType);
                    $this->assertSame($shipment->uuid, $payload['shipment_id']);
                    $this->assertSame($shipment->uuid, $payload['shipment_uuid']);

                    $event = $payload['event'] ?? null;
                    $this->assertIsArray($event);
                    $this->assertArrayNotHasKey('id', $event);
                    $this->assertArrayNotHasKey('uuid', $event);
                    $this->assertArrayHasKey('event_id', $event);
                    $this->assertTrue(\Illuminate\Support\Str::isUuid((string) $event['event_id']));
                    $this->assertTrue(\Illuminate\Support\Str::isUuid((string) $event['account_id']));
                    $this->assertTrue(\Illuminate\Support\Str::isUuid((string) $event['merchant_id']));
                    $this->assertTrue(\Illuminate\Support\Str::isUuid((string) $event['shipment_id']));
                    $this->assertNull($event['booking_id']);

                    return true;
                });
        });

        $job->handle($webhookService);
    }

    public function test_tracking_updated_payload_uses_uuid_identifiers_with_booking(): void
    {
        $merchant = Merchant::factory()->create();
        $shipment = Shipment::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-TRACK-UUID-2',
            'status' => 'draft',
        ]);

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
            'carrier_code' => 'dummy',
            'service_code' => 'standard',
            'currency' => 'ZAR',
            'amount' => 100,
            'tax_amount' => 15,
            'total_amount' => 115,
        ]);

        $booking = Booking::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'shipment_id' => $shipment->id,
            'quote_option_id' => $quoteOption->id,
            'status' => 'booked',
            'carrier_code' => 'dummy',
            'booked_at' => now(),
        ]);

        $job = new ProcessCarrierWebhookJob('dummy', [
            'shipment_uuid' => $shipment->uuid,
            'event_code' => 'out_for_delivery',
            'event_description' => 'Out for delivery',
        ]);

        $webhookService = $this->mock(WebhookService::class, function (MockInterface $mock) use ($booking): void {
            $mock->shouldReceive('fanout')
                ->once()
                ->withArgs(function ($fanoutMerchant, string $eventType, array $payload) use ($booking): bool {
                    $event = $payload['event'] ?? null;
                    $this->assertIsArray($event);
                    $this->assertSame('tracking.updated', $eventType);
                    $this->assertSame($booking->uuid, $event['booking_id']);

                    return true;
                });
        });

        $job->handle($webhookService);
    }
}
