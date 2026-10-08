<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverRunResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $location = fn ($value) => $value ? ['location_id' => $value->uuid, 'name' => $value->name, 'address' => $value->full_address] : null;

        return [
            'run_id' => $this->uuid,
            'reference' => 'Run '.$this->id,
            'status' => $this->status,
            'timezone' => $this->merchant?->timezone ?: config('app.timezone'),
            'vehicle' => $this->vehicle ? ['vehicle_id' => $this->vehicle->uuid, 'plate_number' => $this->vehicle->plate_number, 'ref_code' => $this->vehicle->ref_code] : null,
            'origin' => $location($this->originLocation),
            'destination' => $location($this->destinationLocation),
            'planned_start_at' => $this->formatDateForMerchantTimezone($this->planned_start_at, $request),
            'started_at' => $this->formatDateForMerchantTimezone($this->started_at, $request),
            'completed_at' => $this->formatDateForMerchantTimezone($this->completed_at, $request),
            'shipment_count' => (int) $this->shipment_count,
            'delivered_count' => (int) $this->delivered_count,
            'remaining_count' => max(0, $this->shipment_count - $this->resolved_count),
            'end_request' => $this->latestEndRequest?->toSummary(),
        ];
    }
}
