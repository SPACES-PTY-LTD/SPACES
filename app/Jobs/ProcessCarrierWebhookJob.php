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

        $shipment = Shipment::with(['merchant.account', 'account', 'booking'])
            ->where('uuid', $shipmentUuid)
            ->first();
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

        $accountUuid = $shipment->account?->uuid ?? $shipment->merchant?->account?->uuid;
        $webhookService->fanout($shipment->merchant, 'tracking.updated', [
            'shipment_id' => $shipment->uuid,
            'event' => [
                'event_id' => $event->uuid,
                'account_id' => $accountUuid,
                'merchant_id' => $shipment->merchant?->uuid,
                'shipment_id' => $shipment->uuid,
                'booking_id' => $shipment->booking?->uuid,
                'event_code' => $event->event_code,
                'event_description' => $event->event_description,
                'occurred_at' => optional($event->occurred_at)?->toIso8601String(),
                'payload' => $event->payload,
                'created_at' => optional($event->created_at)?->toIso8601String(),
                'updated_at' => optional($event->updated_at)?->toIso8601String(),
            ],
        ]);
    }
}
