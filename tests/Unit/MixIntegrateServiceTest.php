<?php

namespace Tests\Unit;

use App\Services\Mixtelematics\MixIntegrateService;
use ReflectionMethod;
use Tests\TestCase;

class MixIntegrateServiceTest extends TestCase
{
    public function test_extract_polygon_centroid_preserves_longitude_and_latitude_axes(): void
    {
        $service = new MixIntegrateService();

        $method = new ReflectionMethod($service, 'extractPolygonCentroid');
        $method->setAccessible(true);

        $centroid = $method->invoke(
            $service,
            'POLYGON ((30 -10, 32 -10, 32 -8, 30 -8, 30 -10))'
        );

        $this->assertSame(-9.0, $centroid['latitude']);
        $this->assertSame(31.0, $centroid['longitude']);
    }
}
