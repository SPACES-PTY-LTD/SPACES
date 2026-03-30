<?php

namespace Tests\Unit;

use App\Services\Fleetboard\FleetboardService;
use ReflectionMethod;
use Tests\TestCase;

class FleetboardServiceTest extends TestCase
{
    public function test_map_vehicle_normalizes_basic_fleetboard_fields(): void
    {
        $service = new FleetboardService();
        $method = new ReflectionMethod($service, 'mapVehicle');
        $method->setAccessible(true);

        $result = $method->invoke($service, [
            'vehicleId' => 'truck-1',
            'licensePlate' => 'CA 123',
            'brand' => 'Mercedes-Benz',
            'model' => 'Actros',
            'vin' => 'VIN123',
            'designation' => 'Long Haul Unit',
        ]);

        $this->assertSame('truck-1', $result['integration_id']);
        $this->assertSame('CA 123', $result['plate_number']);
        $this->assertSame('Mercedes-Benz', $result['make']);
        $this->assertSame('Actros', $result['model']);
        $this->assertSame('VIN123', $result['vin_number']);
        $this->assertSame('Long Haul Unit', $result['description']);
    }

    public function test_map_position_normalizes_live_tracking_fields(): void
    {
        $service = new FleetboardService();
        $method = new ReflectionMethod($service, 'mapPosition');
        $method->setAccessible(true);

        $result = $method->invoke($service, [
            'vehicleId' => 'truck-1',
            'timestamp' => '2026-03-28T12:30:00Z',
            'latitude' => '10.1234',
            'longitude' => '20.5678',
            'speed' => '78',
            'odometer' => '152340.4',
            'formattedAddress' => 'Cape Town Depot',
        ]);

        $this->assertSame('truck-1', $result['vehicle_integration_id']);
        $this->assertSame('2026-03-28T12:30:00Z', $result['timestamp']);
        $this->assertSame(10.1234, $result['latitude']);
        $this->assertSame(20.5678, $result['longitude']);
        $this->assertSame(78.0, $result['speed_kilometres_per_hour']);
        $this->assertSame(152340.4, $result['odometer_kilometres']);
        $this->assertSame('Cape Town Depot', $result['formatted_address']);
    }
}
