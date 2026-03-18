<?php

namespace App\Services\Carriers\DTO;

class BookingDTO
{
    public string $bookingUuid;
    public string $carrierCode;
    public string $status;
    public ?string $carrierJobId;
    public ?string $labelUrl;

    public function __construct(array $payload)
    {
        $this->bookingUuid = $payload['booking_uuid'];
        $this->carrierCode = $payload['carrier_code'];
        $this->status = $payload['status'];
        $this->carrierJobId = $payload['carrier_job_id'] ?? null;
        $this->labelUrl = $payload['label_url'] ?? null;
    }
}
