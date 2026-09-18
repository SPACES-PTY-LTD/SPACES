<?php

namespace Tests\Feature;

use App\Services\RunDirectionsService;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class RunDirectionsServiceTest extends TestCase
{
    private function location($latitude, $longitude, bool $demo = true): object
    {
        return (object) ['latitude' => $latitude, 'longitude' => $longitude, 'metadata' => ['demo_map_coordinates' => $demo]];
    }

    public function test_google_road_geometry_preserves_order_and_return_visits(): void
    {
        config(['services.google_maps.routes_api_key' => 'test-key']);
        Http::fake(['routes.googleapis.com/*' => Http::response(['routes' => [[
            'polyline' => ['geoJsonLinestring' => ['coordinates' => [[28.04, -26.14], [28.05, -26.15], [28.04, -26.14]]]],
            'distanceMeters' => 1500, 'duration' => '180s',
        ]]])]);
        $points = [$this->location(-26.14, 28.04), $this->location(-26.15, 28.05), $this->location(-26.14, 28.04), $this->location(-26.14, 28.04)];
        $service = new RunDirectionsService;
        $result = $service->route($points);
        $this->assertSame('ready', $result['status']);
        $this->assertSame(['latitude' => -26.14, 'longitude' => 28.04], $result['coordinates'][0]);
        $this->assertSame(1500, $result['distance_meters']);
        Http::assertSentCount(1);
        Http::assertSent(fn ($request) => $request->hasHeader('X-Goog-Api-Key', 'test-key')
            && $request['origin']['location']['latLng'] === ['latitude' => -26.14, 'longitude' => 28.04]
            && $request['destination'] === $request['origin']
            && count($request['intermediates']) === 1
            && $request['intermediates'][0]['location']['latLng']['latitude'] === -26.15
            && $request['optimizeWaypointOrder'] === false);
    }

    public function test_missing_coordinates_single_stop_and_missing_key_do_not_call_google(): void
    {
        config(['services.google_maps.routes_api_key' => 'test-key']);
        Http::fake();
        $service = new RunDirectionsService;
        $this->assertSame('missing_locations', $service->route([$this->location(null, 28)])['status']);
        $this->assertSame('missing_locations', $service->route([$this->location(91, 28)])['status']);
        config(['services.google_maps.routes_api_key' => null]);
        $this->assertSame('not_configured', $service->route([$this->location(-26, 28), $this->location(-27, 29)])['status']);
        $this->assertSame('not_needed', $service->route([$this->location(-26, 28), $this->location(-26, 28)])['status']);
        Http::assertNothingSent();
    }

    public function test_provider_failure_never_fabricates_a_road_route(): void
    {
        config(['services.google_maps.routes_api_key' => 'test-key']);
        Http::fake(['routes.googleapis.com/*' => Http::response(['code' => 'NoRoute'], 400)]);
        $points = [$this->location(-26, 28), $this->location(-27, 29)];
        $this->assertSame(['status' => 'unavailable'], (new RunDirectionsService)->route($points));
        Http::fake(['routes.googleapis.com/*' => Http::failedConnection()]);
        $this->assertSame(['status' => 'unavailable'], (new RunDirectionsService)->route($points));
    }
}
