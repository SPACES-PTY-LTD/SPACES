<?php

namespace App\Services\Carriers\DTO;

class ShipmentDTO
{
    public string $shipmentUuid;
    public string $merchantUuid;
    public array $pickupAddress;
    public array $dropoffAddress;
    public array $parcels;
    public ?string $collectionDate;
    public ?array $metadata;

    public function __construct(array $payload)
    {
        $this->shipmentUuid = $payload['shipment_uuid'];
        $this->merchantUuid = $payload['merchant_uuid'];
        $this->pickupAddress = $payload['pickup_address'];
        $this->dropoffAddress = $payload['dropoff_address'];
        $this->parcels = $payload['parcels'];
        $this->collectionDate = $payload['collection_date'] ?? null;
        $this->metadata = $payload['metadata'] ?? null;
    }
}
