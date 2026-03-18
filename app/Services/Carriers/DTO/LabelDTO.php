<?php

namespace App\Services\Carriers\DTO;

class LabelDTO
{
    public ?string $labelUrl;
    public ?string $base64Pdf;

    public function __construct(array $payload)
    {
        $this->labelUrl = $payload['label_url'] ?? null;
        $this->base64Pdf = $payload['base64_pdf'] ?? null;
    }
}
