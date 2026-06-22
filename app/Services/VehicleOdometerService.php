<?php

namespace App\Services;

use App\Models\Vehicle;

class VehicleOdometerService
{
    public function syncHigherReading(?Vehicle $vehicle, ?int $odometer): void
    {
        if (!$vehicle || $odometer === null) {
            return;
        }

        $currentOdometer = $vehicle->odometer;
        if ($currentOdometer !== null && $currentOdometer >= $odometer) {
            return;
        }

        $vehicle->forceFill(['odometer' => $odometer])->save();
    }

    public function normalizeKilometres(float|int|null $odometer): ?int
    {
        if ($odometer === null) {
            return null;
        }

        return max(0, (int) round($odometer));
    }
}
