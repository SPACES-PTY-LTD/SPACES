<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class RunDirectionsService
{
    public function route(iterable $locations): array
    {
        $points = [];
        foreach ($locations as $location) {
            if (!$location || !is_numeric($location->latitude) || !is_numeric($location->longitude)
                || abs((float) $location->latitude) > 90 || abs((float) $location->longitude) > 180) {
                return ['status' => 'missing_locations'];
            }
            $point = [(float) $location->longitude, (float) $location->latitude];
            // Remove consecutive duplicates only; a later return to a stop is part of the run.
            if (!$points || end($points) !== $point) $points[] = $point;
        }
        if (count($points) < 2) return ['status' => 'not_needed'];
        if (count($points) > 27) return ['status' => 'too_many_stops'];
        $key = config('services.google_maps.routes_api_key');
        if (!$key) return ['status' => 'not_configured'];
        $waypoint = fn ($p) => ['location' => ['latLng' => ['latitude' => $p[1], 'longitude' => $p[0]]]];
        try {
            $response = Http::acceptJson()->withHeaders([
                'X-Goog-Api-Key' => $key,
                'X-Goog-FieldMask' => 'routes.distanceMeters,routes.duration,routes.polyline.geoJsonLinestring',
            ])->connectTimeout(3)->timeout(15)->post('https://routes.googleapis.com/directions/v2:computeRoutes', [
                'origin' => $waypoint($points[0]),
                'destination' => $waypoint($points[count($points) - 1]),
                'intermediates' => array_map($waypoint, array_slice($points, 1, -1)),
                'travelMode' => 'DRIVE', 'routingPreference' => 'TRAFFIC_UNAWARE',
                'optimizeWaypointOrder' => false, 'computeAlternativeRoutes' => false,
                'polylineQuality' => 'HIGH_QUALITY', 'polylineEncoding' => 'GEO_JSON_LINESTRING',
            ]);
            $route = $response->json('routes.0');
            $coordinates = $route['polyline']['geoJsonLinestring']['coordinates'] ?? [];
            $duration = $route['duration'] ?? '';
            if (!$response->successful() || count($coordinates) < 2
                || !is_numeric($route['distanceMeters'] ?? null) || !preg_match('/^([0-9]+(?:\.[0-9]+)?)s$/', $duration, $match)) {
                return ['status' => 'unavailable'];
            }
            foreach ($coordinates as $point) {
                if (!is_array($point) || count($point) < 2 || !is_numeric($point[0]) || !is_numeric($point[1])
                    || abs($point[0]) > 180 || abs($point[1]) > 90) return ['status' => 'unavailable'];
            }
            $result = ['status' => 'ready', 'coordinates' => array_map(fn ($p) => [
                'latitude' => (float) $p[1], 'longitude' => (float) $p[0],
            ], $coordinates), 'distance_meters' => $route['distanceMeters'], 'duration_seconds' => (float) $match[1]];
            return $result;
        } catch (\Illuminate\Http\Client\ConnectionException $e) {
            return ['status' => 'unavailable'];
        }
    }
}
