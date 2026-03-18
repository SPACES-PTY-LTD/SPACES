<?php

namespace App\Services;

use App\Models\Shipment;
use App\Models\ShipmentParcel;

class ShipmentParcelService
{
    public function __construct(
        private ParcelCodeService $parcelCodeService,
    )
    {
    }

    public function createShipmentParcels(Shipment $shipment, array $parcels): void
    {
        foreach ($parcels as $parcel) {
            $shipment->parcels()->create($this->buildParcelAttributes($shipment, $parcel));
        }
    }

    public function createDefaultAutoCreatedParcel(Shipment $shipment): ShipmentParcel
    {
        return $shipment->parcels()->create($this->buildParcelAttributes($shipment, [
            'contents_description' => 'Parcel #1',
        ]));
    }

    public function ensureDefaultAutoCreatedParcel(Shipment $shipment): ?ShipmentParcel
    {
        $shipment->loadMissing('parcels');

        if ($shipment->parcels->isNotEmpty()) {
            return null;
        }

        return $this->createDefaultAutoCreatedParcel($shipment);
    }

    public function backfillAutoCreatedShipmentParcels(): array
    {
        $summary = [
            'processed' => 0,
            'created' => 0,
        ];

        Shipment::query()
            ->with('parcels')
            ->where('auto_created', true)
            ->orderBy('id')
            ->chunkById(100, function ($shipments) use (&$summary) {
                foreach ($shipments as $shipment) {
                    $summary['processed']++;

                    if ($this->ensureDefaultAutoCreatedParcel($shipment)) {
                        $summary['created']++;
                    }
                }
            });

        return $summary;
    }

    private function buildParcelAttributes(Shipment $shipment, array $parcel): array
    {
        return $parcel + [
            'account_id' => $shipment->account_id,
            'parcel_code' => $this->parcelCodeService->generateUniqueCode(),
        ];
    }
}
