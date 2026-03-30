<?php

namespace App\Services\Fleetboard;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Log;
use SoapClient;
use SoapFault;

class FleetboardService
{
    public function getVehiclePositions(array $assetIds, array $integrationData = []): array
    {
        if (empty($assetIds)) {
            return [];
        }

        $sessionId = $this->login($integrationData);

        try {
            $client = $this->makeClient($this->serviceUrl($integrationData, 'pos_service_url', 'pos'));
            $raw = $this->callFleetboardMethod(
                $client,
                ['getPositions', 'getPosition', 'getPos', 'getLastPositions', 'getLastPosition'],
                [
                    ['sessionId' => $sessionId, 'vehicleIds' => array_values($assetIds)],
                    ['sessionId' => $sessionId, 'vehicleId' => count($assetIds) === 1 ? $assetIds[0] : null],
                    ['sessionId' => $sessionId],
                    [array_values($assetIds)],
                    [],
                ]
            );

            return array_values(array_filter(array_map(
                fn ($item) => is_array($item) ? $this->mapPosition($item) : null,
                $this->normalizeList($raw)
            )));
        } finally {
            $this->logoutQuietly($integrationData, $sessionId);
        }
    }

    public function import_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return $this->list_importable_vehicles($integrationData, $integrationOptionsData);
    }

    public function list_importable_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
    {
        $sessionId = $this->login($integrationData);

        try {
            $client = $this->makeClient($this->serviceUrl($integrationData, 'basic_service_url', 'basic'));
            $raw = $this->callFleetboardMethod(
                $client,
                ['getVehicle', 'getVehicles', 'getFleet'],
                [
                    ['sessionId' => $sessionId],
                    [],
                    [$sessionId],
                ]
            );

            return array_values(array_filter(array_map(
                fn ($item) => is_array($item) ? $this->mapVehicle($item) : null,
                $this->normalizeList($raw)
            )));
        } finally {
            $this->logoutQuietly($integrationData, $sessionId);
        }
    }

    private function login(array $integrationData): string
    {
        $username = (string) ($integrationData['username'] ?? '');
        $password = (string) ($integrationData['password'] ?? '');

        if ($username === '' || $password === '') {
            throw new \RuntimeException('Fleetboard username and password are required.');
        }

        $client = $this->makeClient($this->serviceUrl($integrationData, 'basic_service_url', 'basic'));
        $response = $this->callFleetboardMethod(
            $client,
            ['login'],
            [
                ['username' => $username, 'password' => $password],
                [$username, $password],
            ]
        );

        $sessionId = $this->extractScalar(
            $response,
            ['sessionId', 'session_id', 'loginReturn', 'return', 'result', 'LoginReturn']
        );

        if ($sessionId === null || $sessionId === '') {
            throw new \RuntimeException('Fleetboard login did not return a session identifier.');
        }

        return (string) $sessionId;
    }

    private function logoutQuietly(array $integrationData, string $sessionId): void
    {
        try {
            $client = $this->makeClient($this->serviceUrl($integrationData, 'basic_service_url', 'basic'));
            $this->callFleetboardMethod(
                $client,
                ['logout'],
                [
                    ['sessionId' => $sessionId],
                    [$sessionId],
                    [],
                ]
            );
        } catch (\Throwable $exception) {
            Log::warning('Fleetboard logout failed.', [
                'message' => $exception->getMessage(),
            ]);
        }
    }

    private function makeClient(string $serviceUrl): SoapClient
    {
        return new SoapClient($this->wsdlUrl($serviceUrl), [
            'trace' => true,
            'exceptions' => true,
            'cache_wsdl' => WSDL_CACHE_NONE,
            'connection_timeout' => 20,
            'features' => SOAP_SINGLE_ELEMENT_ARRAYS,
        ]);
    }

    private function callFleetboardMethod(SoapClient $client, array $methods, array $argumentSets): mixed
    {
        $lastException = null;

        foreach ($methods as $method) {
            foreach ($argumentSets as $arguments) {
                $filteredArguments = array_values(array_filter(
                    is_array($arguments) ? $arguments : [$arguments],
                    static fn ($value) => $value !== null
                ));

                try {
                    return $client->__soapCall($method, $filteredArguments);
                } catch (SoapFault $exception) {
                    $lastException = $exception;
                }
            }
        }

        throw $lastException ?? new \RuntimeException('Fleetboard SOAP call failed.');
    }

    private function mapVehicle(array $item): ?array
    {
        $integrationId = $this->extractScalar($item, [
            'vehicleId',
            'vehicle_id',
            'id',
            'truckId',
            'truck_id',
            'vin',
            'VIN',
        ]);

        if ($integrationId === null || $integrationId === '') {
            return null;
        }

        return [
            'integration_id' => (string) $integrationId,
            'plate_number' => $this->extractScalar($item, ['licensePlate', 'numberPlate', 'plateNumber', 'registrationNumber']),
            'make' => $this->extractScalar($item, ['brand', 'make']),
            'model' => $this->extractScalar($item, ['model']),
            'vin_number' => $this->extractScalar($item, ['vin', 'VIN']),
            'ref_code' => $this->extractScalar($item, ['designation', 'name', 'vehicleName']),
            'description' => $this->extractScalar($item, ['designation', 'description', 'name', 'vehicleName']),
            'provider_payload' => $item,
        ];
    }

    private function mapPosition(array $item): array
    {
        $vehicleId = $this->extractScalar($item, [
            'vehicleId',
            'vehicle_id',
            'truckId',
            'truck_id',
            'vin',
            'VIN',
            'id',
        ]);

        $latitude = $this->extractNumeric($item, ['latitude', 'lat', 'y']);
        $longitude = $this->extractNumeric($item, ['longitude', 'lng', 'lon', 'x']);

        return [
            'timestamp' => $this->extractScalar($item, ['timestamp', 'timeStamp', 'recordedAt', 'recorded_at', 'time']),
            'longitude' => $longitude,
            'latitude' => $latitude,
            'speed_kilometres_per_hour' => $this->extractNumeric($item, ['speed', 'speedKph', 'speedInKmh']),
            'driver_integration_id' => $this->extractScalar($item, ['driverId', 'driver_id']),
            'vehicle_integration_id' => $vehicleId !== null ? (string) $vehicleId : null,
            'formatted_address' => $this->extractScalar($item, ['formattedAddress', 'address', 'street']),
            'odometer_kilometres' => $this->extractNumeric($item, ['odometer', 'mileage', 'odometerKilometres']),
            'provider_payload' => $item,
        ];
    }

    private function serviceUrl(array $integrationData, string $field, string $type): string
    {
        $value = trim((string) ($integrationData[$field] ?? ''));
        if ($value !== '') {
            return $value;
        }

        if ($type === 'basic') {
            return 'https://soap.api.fleetboard.com/soap_v1_1/services/BasicService';
        }

        return 'https://soap.api.fleetboard.com/soap_v1_1/services/PosService';
    }

    private function wsdlUrl(string $serviceUrl): string
    {
        return str_contains($serviceUrl, '?wsdl')
            ? $serviceUrl
            : rtrim($serviceUrl, '?') . '?wsdl';
    }

    private function normalizeList(mixed $payload): array
    {
        if (is_array($payload)) {
            if (array_is_list($payload)) {
                return $payload;
            }

            foreach (['vehicles', 'vehicle', 'positions', 'position', 'return', 'result', 'items'] as $key) {
                $value = $payload[$key] ?? null;
                if (is_array($value)) {
                    return array_is_list($value) ? $value : [$value];
                }
            }

            $flattened = [];
            foreach ($payload as $value) {
                if (is_array($value)) {
                    $flattened = [...$flattened, ...$this->normalizeList($value)];
                }
            }

            return !empty($flattened) ? $flattened : [$payload];
        }

        if (is_object($payload)) {
            return $this->normalizeList(json_decode(json_encode($payload), true));
        }

        return [];
    }

    private function extractScalar(array $payload, array $keys): string|int|float|null
    {
        foreach ($keys as $key) {
            $value = Arr::get($payload, $key);
            if (is_scalar($value) && $value !== '') {
                return $value;
            }
        }

        foreach ($payload as $value) {
            if (is_array($value)) {
                $nested = $this->extractScalar($value, $keys);
                if ($nested !== null && $nested !== '') {
                    return $nested;
                }
            }
        }

        return null;
    }

    private function extractNumeric(array $payload, array $keys): ?float
    {
        $value = $this->extractScalar($payload, $keys);

        return is_numeric($value) ? (float) $value : null;
    }
}
