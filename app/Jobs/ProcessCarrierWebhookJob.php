<?php

namespace App\Jobs;

use App\Models\Shipment;
use App\Models\TrackingEvent;
use App\Services\WebhookService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class ProcessCarrierWebhookJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public string $carrierCode, public array $payload)
    {
    }

    public function handle(WebhookService $webhookService): void
    {
        $shipmentUuid = $this->payload['shipment_id'] ?? $this->payload['shipment_uuid'] ?? null;
        if (!$shipmentUuid) {
            return;
        }

        $shipment = Shipment::where('uuid', $shipmentUuid)->first();
        if (!$shipment) {
            return;
        }

        $event = TrackingEvent::create([
            'account_id' => $shipment->account_id,
            'merchant_id' => $shipment->merchant_id,
            'shipment_id' => $shipment->id,
            'booking_id' => optional($shipment->booking)->id,
            'event_code' => $this->payload['event_code'] ?? 'carrier_event',
            'event_description' => $this->payload['event_description'] ?? null,
            'occurred_at' => $this->payload['occurred_at'] ?? now(),
            'payload' => $this->payload,
        ]);

        $webhookService->fanout($shipment->merchant, 'tracking.updated', [
            'shipment_id' => $shipment->uuid,
            'shipment_uuid' => $shipment->uuid,
            'event' => $event->toArray(),
        ]);
    }
}
