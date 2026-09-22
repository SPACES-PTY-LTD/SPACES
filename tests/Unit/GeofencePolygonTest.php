<?php

namespace Tests\Unit;

use App\Support\GeofencePolygon;
use PHPUnit\Framework\TestCase;

class GeofencePolygonTest extends TestCase
{
    public function test_strict_containment_and_longitude_latitude_order(): void
    {
        $polygon = GeofencePolygon::fromWkt('POLYGON((28 -26, 29 -26, 29 -25, 28 -25, 28 -26))');
        $this->assertNotNull($polygon);
        $this->assertTrue($polygon->contains(-25.5, 28.5));
        foreach ([[-26, 28], [-26, 28.5], [-25, 28.5], [-25.5, 28], [-25.5, 29], [-26.00001, 28.5], [28.5, -25.5], [NAN, 28]] as [$lat, $lng]) {
            $this->assertFalse($polygon->contains($lat, $lng));
        }
    }

    public function test_invalid_polygons_fail_closed(): void
    {
        foreach ([null, '', 'POLYGON EMPTY', 'POLYGON((0 0, 1 1, 0 0))', 'POLYGON((0 0, 1 0, 1 1))', 'POLYGON((0 0, bad 1, 1 1, 0 0))', 'POLYGON((0 0, 2 2, 0 2, 2 0, 0 0))', 'POLYGON((0 0, 1 1, 2 2, 0 0))', 'POLYGON((0 91, 1 91, 1 92, 0 91))', 'POLYGON((0 0, 1 0, 1 0, 0 0))', 'POLYGON((0 0, 4 0, 4 4, 0 0),(1 1, 2 1, 1 2, 1 1))'] as $wkt) {
            $this->assertNull(GeofencePolygon::fromWkt($wkt), (string) $wkt);
        }
    }

    public function test_concave_polygon_uses_verified_interior_instead_of_average_vertices(): void
    {
        $polygon = GeofencePolygon::fromWkt('POLYGON((0 0, 4 0, 4 1, 1 1, 1 4, 0 4, 0 0))');
        $this->assertNotNull($polygon);
        $this->assertFalse($polygon->contains(2, 2));
        $this->assertTrue($polygon->contains(...$polygon->interiorPoint()));
        $this->assertTrue($polygon->contains(3, 0.5));
        $this->assertFalse($polygon->contains(1, 2));
    }
}
