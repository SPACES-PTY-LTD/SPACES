<?php

namespace App\Support;

/** Validated simple polygon, stored as [latitude, longitude] points. */
final class GeofencePolygon
{
    private function __construct(private array $points) {}

    public static function fromWkt(?string $wkt): ?self
    {
        // LocationService writes a single closed ring in longitude/latitude order.
        if (! $wkt || ! preg_match('/^\s*POLYGON\s*\(\(\s*([^()]+)\s*\)\)\s*$/i', $wkt, $match)) {
            return null;
        }
        $points = [];
        foreach (explode(',', $match[1]) as $pair) {
            $parts = preg_split('/\s+/', trim($pair));
            if (count($parts) !== 2 || ! is_numeric($parts[0]) || ! is_numeric($parts[1])) {
                return null;
            }
            [$lng, $lat] = array_map('floatval', $parts);
            if (! is_finite($lat) || ! is_finite($lng) || abs($lat) > 90 || abs($lng) > 180) {
                return null;
            }
            $points[] = [$lat, $lng];
        }
        if (count($points) < 4 || $points[0] !== $points[count($points) - 1]) {
            return null;
        }
        array_pop($points);
        $count = count($points);
        for ($i = 0; $i < $count; $i++) {
            if ($points[$i] === $points[($i + 1) % $count]) {
                return null;
            }
            for ($j = $i + 1; $j < $count; $j++) {
                if ($j === $i + 1 || ($i === 0 && $j === $count - 1)) {
                    continue;
                }
                if (self::intersects($points[$i], $points[($i + 1) % $count], $points[$j], $points[($j + 1) % $count])) {
                    return null;
                }
            }
        }
        $polygon = new self($points);

        // A scanline interior also rejects degenerate rings with no interior area.
        return $polygon->interiorPoint() !== null ? $polygon : null;
    }

    private static function cross(array $a, array $b, array $p): float
    {
        return ($b[0] - $a[0]) * ($p[1] - $a[1]) - ($b[1] - $a[1]) * ($p[0] - $a[0]);
    }

    private static function onEdge(array $a, array $b, array $p): bool
    {
        // Floating-point precision only; this is not a geographic distance buffer.
        return abs(self::cross($a, $b, $p)) <= 1e-14
            && $p[0] >= min($a[0], $b[0]) && $p[0] <= max($a[0], $b[0])
            && $p[1] >= min($a[1], $b[1]) && $p[1] <= max($a[1], $b[1]);
    }

    private static function intersects(array $a, array $b, array $c, array $d): bool
    {
        if (self::onEdge($a, $b, $c) || self::onEdge($a, $b, $d) || self::onEdge($c, $d, $a) || self::onEdge($c, $d, $b)) {
            return true;
        }

        return self::cross($a, $b, $c) * self::cross($a, $b, $d) < 0
            && self::cross($c, $d, $a) * self::cross($c, $d, $b) < 0;
    }

    public function contains(float $latitude, float $longitude): bool
    {
        if (! is_finite($latitude) || ! is_finite($longitude) || abs($latitude) > 90 || abs($longitude) > 180) {
            return false;
        }
        $inside = false;
        $count = count($this->points);
        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $a = $this->points[$j];
            $b = $this->points[$i];
            if (self::onEdge($a, $b, [$latitude, $longitude])) {
                return false;
            }
            if (($a[0] > $latitude) !== ($b[0] > $latitude)
                && $longitude < ($b[1] - $a[1]) * ($latitude - $a[0]) / ($b[0] - $a[0]) + $a[1]) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }

    public function interiorPoint(): ?array
    {
        $levels = array_values(array_unique(array_column($this->points, 0)));
        sort($levels, SORT_NUMERIC);
        for ($level = 1; $level < count($levels); $level++) {
            $lat = ($levels[$level - 1] + $levels[$level]) / 2;
            $intersections = [];
            $count = count($this->points);
            for ($i = 0; $i < $count; $i++) {
                $a = $this->points[$i];
                $b = $this->points[($i + 1) % $count];
                if (($a[0] > $lat) !== ($b[0] > $lat)) {
                    $intersections[] = $a[1] + ($lat - $a[0]) * ($b[1] - $a[1]) / ($b[0] - $a[0]);
                }
            }
            sort($intersections, SORT_NUMERIC);
            for ($i = 0; $i + 1 < count($intersections); $i += 2) {
                $lng = ($intersections[$i] + $intersections[$i + 1]) / 2;
                if ($this->contains($lat, $lng)) {
                    return [$lat, $lng];
                }
            }
        }

        return null;
    }
}
