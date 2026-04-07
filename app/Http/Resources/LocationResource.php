<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class LocationResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        //if no full_address use the rest of the address fields to construct one
        if (empty($this->full_address)) {
            $parts = array_filter([
                $this->address_line_1,
                $this->address_line_2,
                $this->town,
                $this->city,
                $this->province,
                $this->post_code,
                $this->country,
            ]);
            $this->full_address = implode(', ', $parts);
        }
        return [
            'location_id' => $this->uuid,
            'name' => $this->name,
            'code' => $this->code,
            'company' => $this->company,
            'full_address' => $this->full_address,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'town' => $this->town,
            'city' => $this->city,
            'country' => $this->country,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'province' => $this->province,
            'post_code' => $this->post_code,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'polygon_bounds' => $this->formatPolygonBounds($this->polygon_bounds),
            'google_place_id' => $this->google_place_id,
            'type'=> $this->locationType ? new LocationTypeResource($this->locationType) : null,
            'tags' => TagResource::collection($this->whenLoaded('tags')),
            'metadata' => $this->metadata,
            'intergration_id' => $this->intergration_id,
            'imported_at' => optional($this->imported_at)?->toIso8601String(),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }

    private function formatPolygonBounds($value): ?array
    {
        if ($value === null) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || stripos($value, 'POLYGON') !== 0) {
            return null;
        }

        $start = strpos($value, '((');
        $end = strrpos($value, '))');
        if ($start === false || $end === false || $end <= $start + 1) {
            return null;
        }

        $body = substr($value, $start + 2, $end - $start - 2);
        $pairs = array_filter(array_map('trim', explode(',', $body)));
        $points = [];

        foreach ($pairs as $pair) {
            $parts = preg_split('/\\s+/', trim($pair));
            if (count($parts) !== 2) {
                continue;
            }
            // Stored WKT is "longitude latitude"; API polygon arrays use [latitude, longitude].
            $points[] = [(float) $parts[1], (float) $parts[0]];
        }

        return $points ?: null;
    }
}
