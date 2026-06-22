<?php

namespace App\Services;

use App\Models\Shipment;
use App\Models\ShipmentParcel;
use Illuminate\Support\Facades\Schema;

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
        if (!Schema::hasColumn('shipment_parcels', 'weight') && Schema::hasColumn('shipment_parcels', 'weight_kg')) {
            if (array_key_exists('weight', $parcel) && !array_key_exists('weight_kg', $parcel)) {
                $parcel['weight_kg'] = $parcel['weight'];
                unset($parcel['weight']);
            }
        } elseif (array_key_exists('weight_kg', $parcel) && !array_key_exists('weight', $parcel)) {
            $parcel['weight'] = $parcel['weight_kg'];
            unset($parcel['weight_kg']);
        }

        return $parcel + [
            'account_id' => $shipment->account_id,
            'parcel_code' => $this->parcelCodeService->generateUniqueCode(),
        ];
    }
}
