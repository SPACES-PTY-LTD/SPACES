<?php

namespace App\Services;

use App\Models\RunAnalysis;
use App\Support\RunActivityQuery;

class RunAnalysisLocationDetails
{
    public function fromPosition(mixed $position, float $latitude, float $longitude): array
    {
        if (! is_array($position)) {
            return [];
        }
        // Only describe this recorded coordinate, never the vehicle's latest position.
        $lat = $position['latitude'] ?? $position['Latitude'] ?? null;
        $lng = $position['longitude'] ?? $position['Longitude'] ?? null;
        if (! is_numeric($lat) || ! is_numeric($lng) || ! is_finite((float) $lat) || ! is_finite((float) $lng) || abs((float) $lat - $latitude) > 0.00001 || abs((float) $lng - $longitude) > 0.00001) {
            return [];
        }
        $name = $this->text($position['location_name'] ?? $position['LocationName'] ?? $position['locationName'] ?? null, 200);
        $address = $this->text($position['formatted_address'] ?? $position['FormattedAddress'] ?? $position['formattedAddress'] ?? null, 255);

        return $name || $address ? ['provider_name' => $name, 'provider_address' => $address, 'description_source' => 'Recorded tracking position'] : [];
    }

    public function candidates(RunAnalysis $analysis): array
    {
        $candidates = collect($analysis->input_snapshot['missing_location_candidates'] ?? [])->whereIn('candidate_id', array_column($analysis->report['missing_locations'] ?? [], 'candidate_id'));
        if ($candidates->isEmpty()) {
            return [];
        }
        // Recover descriptions for reports saved before enrichment was introduced.
        $events = RunActivityQuery::forRuns([$analysis->run_id])->select('vehicle_activity.*')
            ->where('vehicle_activity.account_id', $analysis->account_id)->where('vehicle_activity.merchant_id', $analysis->merchant_id)
            ->where('vehicle_activity.event_type', 'stopped')->whereIn('vehicle_activity.uuid', $candidates->pluck('candidate_id'))
            ->get()->keyBy('uuid');

        return $candidates->map(function ($candidate) use ($events) {
            if (array_key_exists('description_source', $candidate)) {
                return $candidate;
            }
            $event = $events->get($candidate['candidate_id']);

            return array_merge($candidate, $this->fromPosition($event?->metadata['provider_position'] ?? [], $candidate['latitude'], $candidate['longitude']));
        })->keyBy('candidate_id')->all();
    }

    private function text(mixed $value, int $limit): ?string
    {
        return is_string($value) && trim($value) !== '' ? mb_substr(trim($value), 0, $limit) : null;
    }
}
