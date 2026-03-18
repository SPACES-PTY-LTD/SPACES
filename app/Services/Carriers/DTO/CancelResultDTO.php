<?php

namespace App\Services\Carriers\DTO;

class CancelResultDTO
{
    public string $status;
    public ?string $reason;

    public function __construct(array $payload)
    {
        $this->status = $payload['status'];
        $this->reason = $payload['reason'] ?? null;
    }
}
