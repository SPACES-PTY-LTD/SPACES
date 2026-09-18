<?php

namespace App\Support;

class RunDistance
{
    public static function gpsDistanceKm(array $points): float
    {
        $distance = 0.0;

        for ($index = 1, $count = count($points); $index < $count; $index++) {
            $previous = $points[$index - 1];
            $current = $points[$index];
            $latitudeDelta = deg2rad($current['latitude'] - $previous['latitude']);
            $longitudeDelta = deg2rad($current['longitude'] - $previous['longitude']);
            $a = sin($latitudeDelta / 2) ** 2
                + cos(deg2rad($previous['latitude'])) * cos(deg2rad($current['latitude']))
                * sin($longitudeDelta / 2) ** 2;
            $a = min(1, max(0, $a));
            $distance += 6371.0088 * 2 * atan2(sqrt($a), sqrt(1 - $a));
        }

        return $distance;
    }
}
