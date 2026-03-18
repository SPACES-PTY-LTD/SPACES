<?php

namespace App\Services\Carriers;

class CarrierManager
{
    public function adapter(string $carrierCode): CarrierAdapter
    {
        $carrier = $carrierCode ?: config('carriers.default', 'dummy');

        return match ($carrier) {
            default => new DummyCarrierAdapter(),
        };
    }
}
