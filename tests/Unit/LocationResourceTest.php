<?php

namespace Tests\Unit;

use App\Http\Resources\LocationResource;
use App\Models\Location;
use Illuminate\Http\Request;
use Tests\TestCase;

class LocationResourceTest extends TestCase
{
    public function test_polygon_bounds_from_wkt_are_serialized_as_latitude_longitude_pairs(): void
    {
        $location = new Location([
            'polygon_bounds' => 'POLYGON ((30 -10, 32 -10, 32 -8, 30 -8, 30 -10))',
        ]);

        $payload = (new LocationResource($location))->toArray(Request::create('/'));

        $this->assertSame([
            [-10.0, 30.0],
            [-10.0, 32.0],
            [-8.0, 32.0],
            [-8.0, 30.0],
            [-10.0, 30.0],
        ], $payload['polygon_bounds']);
    }
}
