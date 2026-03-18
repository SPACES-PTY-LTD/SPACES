<?php

namespace App\Jobs;

use App\Models\Quote;
use App\Services\Carriers\CarrierManager;
use App\Services\Carriers\DTO\ShipmentDTO;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class QuoteRequestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $quoteId)
    {
    }

    public function handle(CarrierManager $carrierManager): void
    {
        $quote = Quote::with(['shipment.parcels', 'shipment.pickupLocation', 'shipment.dropoffLocation', 'merchant'])
            ->findOrFail($this->quoteId);

        $shipment = $quote->shipment;
        $dto = new ShipmentDTO([
            'shipment_uuid' => $shipment->uuid,
            'merchant_uuid' => $quote->merchant->uuid,
            'pickup_address' => $shipment->pickupAddressArray(),
            'dropoff_address' => $shipment->dropoffAddressArray(),
            'parcels' => $shipment->parcels->toArray(),
            'collection_date' => optional($shipment->collection_date)?->toIso8601String(),
            'metadata' => $shipment->metadata,
        ]);

        $adapter = $carrierManager->adapter(config('carriers.default', 'internal'));
        $options = $adapter->quote($dto);

        foreach ($options->options as $option) {
            $quote->options()->create([
                'account_id' => $quote->account_id,
                'carrier_code' => $option->carrierCode,
                'service_code' => $option->serviceCode,
                'currency' => $option->currency,
                'amount' => $option->amount,
                'tax_amount' => $option->taxAmount,
                'total_amount' => $option->totalAmount,
                'eta_from' => $option->etaFrom,
                'eta_to' => $option->etaTo,
                'rules' => $option->rules,
            ]);
        }
    }
}
