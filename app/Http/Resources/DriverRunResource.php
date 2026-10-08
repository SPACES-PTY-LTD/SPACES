<?php

namespace App\Http\Resources;

use App\Http\Resources\Concerns\FormatsMerchantTimestamps;
use App\Models\Run;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class DriverRunResource extends JsonResource
{
    use FormatsMerchantTimestamps;

    public function toArray(Request $request): array
    {
        $location = fn ($value) => $value ? ['location_id' => $value->uuid, 'name' => $value->name, 'address' => $value->full_address] : null;
        $end = $this->relationLoaded('recordedEndStop') ? $this->recordedEndStop : null;
        // A planned destination or last visited stop is not evidence of the finish.
        $recordedEnd = $this->status === Run::STATUS_COMPLETED && $this->completed_at && $end
            && $end->vehicle_id === $this->vehicle_id && $end->occurred_at?->equalTo($this->completed_at)
            ? $location($end->location) : null;

        return [
            'run_id' => $this->uuid,
            'reference' => 'Run '.$this->id,
            'status' => $this->status,
            'timezone' => $this->merchant?->timezone ?: config('app.timezone'),
            'vehicle' => $this->vehicle ? ['vehicle_id' => $this->vehicle->uuid, 'plate_number' => $this->vehicle->plate_number, 'ref_code' => $this->vehicle->ref_code] : null,
            'origin' => $location($this->originLocation),
            'destination' => $location($this->destinationLocation),
            'current_location' => $this->currentLocation(),
            'recorded_end' => $recordedEnd,
            'planned_start_at' => $this->formatDateForMerchantTimezone($this->planned_start_at, $request),
            'started_at' => $this->formatDateForMerchantTimezone($this->started_at, $request),
            'completed_at' => $this->formatDateForMerchantTimezone($this->completed_at, $request),
            'shipment_count' => (int) $this->shipment_count,
            'delivered_count' => (int) $this->delivered_count,
            'remaining_count' => max(0, $this->shipment_count - $this->resolved_count),
            'end_request' => $this->latestEndRequest?->toSummary(),
        ];
    }

    private function currentLocation(): ?array
    {
        $vehicle = $this->vehicle;
        $reportedAt = $vehicle?->location_updated_at;
        if ($this->status !== Run::STATUS_IN_PROGRESS || ! $this->started_at || ! $vehicle || ! $reportedAt
            || ($vehicle->last_driver_id !== null && $vehicle->last_driver_id !== $this->driver_id)
            || $reportedAt->lt($this->started_at) || $reportedAt->lt(now()->subMinutes(15)) || $reportedAt->gt(now())) {
            return null;
        }

        $position = $vehicle->last_location_address ?? [];
        $string = fn ($value) => is_string($value) && trim($value) !== '' ? trim($value) : null;
        $name = $string($position['name'] ?? null);
        $address = $string($position['formatted_address'] ?? null) ?? implode(', ', array_filter(array_map($string, [
            $position['address_line_1'] ?? null, $position['city'] ?? null, $position['province'] ?? null, $position['post_code'] ?? null,
        ])));
        if (! $name && ! $address) {
            $lat = $position['latitude'] ?? null;
            $lng = $position['longitude'] ?? null;
            if (! is_numeric($lat) || ! is_numeric($lng) || abs((float) $lat) > 90 || abs((float) $lng) > 180) {
                return null;
            }
            $name = sprintf('%.5f, %.5f', $lat, $lng);
        }

        return ['name' => $name ?: $address, 'address' => $name && $address ? $address : null, 'reported_at' => $reportedAt->toIso8601String()];
    }
}
