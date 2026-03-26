<?php

namespace App\Services\Mixtelematics;

use App\Models\LocationType;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class MixIntegrateService
{
    public function getVehiclePositions(array $assetIds, array $integrationData = []): array
    {
        if (empty($assetIds)) {
            return [];
        }

        // MiX expects 64-bit numeric ids in JSON, not quoted strings.
        $assetIds = array_values(array_map(
            fn($id) => (int) str_replace('_', '', (string) $id),
            $assetIds
        ));

        $token = $this->getBearerToken($integrationData);
        $baseUrl = $integrationData['rest_base_url'] ?? config('services.mix.rest_base_url');

        $client = Http::baseUrl($baseUrl)
            ->asJson()
            ->acceptJson()
            ->withToken($token)
            ->timeout(20);

        $requestPath = '/api/positions/assets/latest/1';
        $payload = $assetIds;

        $response = $client->post($requestPath, $payload);

        // Some environments bind this endpoint to { "AssetIds": [...] }.
        if (
            $response->status() === 400
            && str_contains($response->body(), 'AssetIds list not supplied')
        ) {
            $payload = ['AssetIds' => $assetIds];
            $response = $client->post($requestPath, $payload);
        }

        if ($response->failed()) {
            Log::warning('Mix Integrate latest positions request failed.', [
                'baseUrl' => $baseUrl,
                'token' => substr($token, 0, 10) . '...',
                'assetIds' => $assetIds,
                'payload' => $payload,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        $raw = $response->json();
        if (!is_array($raw)) {
            return [];
        }

        $list = $raw['positions'] ?? $raw['Positions'] ?? $raw['data'] ?? $raw;
        if (!is_array($list)) {
            return [];
        }

        if (!array_is_list($list)) {
            return $this->mapPosition($list);
        }

        return array_values(array_filter(array_map(function ($item) {
            if (!is_array($item)) {
                return null;
            }

            return $this->mapPosition($item);
        }, $list)));
    }

    public function import_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
    {
        return $this->list_importable_vehicles($integrationData, $integrationOptionsData);
    }

    public function list_importable_vehicles(array $integrationData = [], array $integrationOptionsData = []): array
    {
        $token = $this->getBearerToken($integrationData);
        $baseUrl = $integrationData['rest_base_url'] ?? config('services.mix.rest_base_url');
        $organisationId = $integrationData['organisation_id'] ?? null;

        if (!$organisationId) {
            throw new \RuntimeException('MiX organisation_id is required to import vehicles..');
        }

        $client = Http::baseUrl($baseUrl)
            ->acceptJson()
            ->withToken($token)
            ->timeout(30);

        $path = '/api/assets/group/' . $organisationId;
        $response = $client->get($path);

        if ($response->failed()) {
            Log::warning('Mix Integrate assets import request failed.', [
                'baseUrl' => $baseUrl,
                'path' => $path,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        $raw = $response->json();
        if (!is_array($raw)) {
            return [];
        }

        $list = $raw['assets'] ?? $raw['Assets'] ?? $raw['data'] ?? $raw['items'] ?? $raw;
        if (!is_array($list)) {
            return [];
        }

        if (!array_is_list($list)) {
            $list = [$list];
        }

        $vehicles = [];
        foreach ($list as $item) {
            
            if (!is_array($item)) {
                continue;
            }

            // if IsConnectedTrailer continue
            if (($item['isConnectedTrailer'] ?? $item['IsConnectedTrailer'] ?? false) === true) {
                continue;
            }

            // is UserState=="Decommissioned"
            if (($item['userState'] ?? $item['UserState'] ?? '') === 'Decommissioned') {
                continue;
            }


            $assetId = $item['assetId']
                ?? $item['AssetId']
                ?? $item['id']
                ?? $item['Id']
                ?? null;

            if ($assetId === null || $assetId === '') {
                continue;
            }

            $vehicles[] = [
                'integration_id' => $this->formatMixAssetId($assetId),
                'plate_number' => $item['registrationNumber']
                    ?? $item['RegistrationNumber']
                    ?? $item['licensePlate']
                    ?? $item['LicensePlate']
                    ?? null,
                'make' => $item['make'] ?? $item['Make'] ?? null,
                'model' => $item['model'] ?? $item['Model'] ?? null,
                'color' => $item['color'] ?? $item['Colour'] ?? null,
                'vin_number' => $item['vin']
                    ?? $item['VIN']
                    ?? $item['vinNumber']
                    ?? $item['VinNumber']
                    ?? null,
                'engine_number' => $item['engineNumber'] ?? $item['EngineNumber'] ?? null,
                'ref_code' => $item['assetNumber']
                    ?? $item['AssetNumber']
                    ?? $item['fleetNumber']
                    ?? $item['FleetNumber']
                    ?? $item['description']
                    ?? $item['Description']
                    ?? null,
                'description' => $item['description']
                    ?? $item['Description']
                    ?? $item['assetNumber']
                    ?? $item['AssetNumber']
                    ?? $item['fleetNumber']
                    ?? $item['FleetNumber']
                    ?? null,
                'odometer' => $item['odometer']
                    ?? $item['Odometer']
                    ?? $item['odometer_kilometres']
                    ?? $item['OdometerKilometres']
                    ?? null,
                'year' => $item['year']
                    ?? $item['Year']
                    ?? $item['modelYear']
                    ?? $item['ModelYear']
                    ?? null,
                'driver_integration_id' => $item['driverId'] ?? $item['DriverId'] ?? null,
                'provider_payload' => $item,
            ];
        }

        return $vehicles;
    }

    public function import_drivers(array $integrationData = [], array $integrationOptionsData = []): array
    {
        $token = $this->getBearerToken($integrationData);
        $baseUrl = $integrationData['rest_base_url'] ?? config('services.mix.rest_base_url');
        $organisationId = $integrationData['organisation_id'] ?? null;

        if (!$organisationId) {
            throw new \RuntimeException('MiX organisation_id is required to import drivers.');
        }

        

        $client = Http::baseUrl($baseUrl)
            ->acceptJson()
            ->withToken($token)
            ->timeout(360);

        $path = '/api/drivers/group/' . $organisationId;

        $response = $client->get($path);

        if ($response->failed()) {
            Log::warning('Mix Integrate drivers import request failed.', [
                'baseUrl' => $baseUrl,
                'path' => $path,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        $raw = $response->json();
        if (!is_array($raw)) {
            return [];
        }

        $list = $raw['drivers'] ?? $raw['Drivers'] ?? $raw['data'] ?? $raw['items'] ?? $raw;
        if (!is_array($list)) {
            return [];
        }

        if (!array_is_list($list)) {
            $list = [$list];
        }

        $drivers = [];
        foreach ($list as $item) {
            if (!is_array($item)) {
                continue;
            }

            $driverId = $item['driverId']
                ?? $item['DriverId']
                ?? $item['id']
                ?? $item['Id']
                ?? null;

            if ($driverId === null || $driverId === '') {
                continue;
            }

            $name = $item['name']
                ?? $item['Name']
                ?? trim((string) (($item['firstName'] ?? $item['FirstName'] ?? '').' '.($item['lastName'] ?? $item['LastName'] ?? '')))
                ?? null;

            $drivers[] = [
                'integration_id' => (string) $driverId,
                'name' => $name !== '' ? $name : null,
                'email' => $item['email']
                    ?? $item['Email']
                    ?? null,
                'telephone' => $item['telephone']
                    ?? $item['Telephone']
                    ?? $item['mobileNumber']
                    ?? $item['MobileNumber']
                    ?? null,
                'is_active' => $item['isActive']
                    ?? $item['IsActive']
                    ?? $item['active']
                    ?? $item['Active']
                    ?? null,
                'notes' => $item['notes']
                    ?? $item['Notes']
                    ?? null,
                'provider_payload' => $item,
            ];
        }

        return $drivers;
    }

    public function import_locations(array $integrationData = [], array $integrationOptionsData = []): array
    {
        $token = $this->getBearerToken($integrationData);
        $baseUrl = $integrationData['rest_base_url'] ?? config('services.mix.rest_base_url');
        $organisationId = $integrationData['organisation_id'] ?? null;
        
        $onlyWithGeofences = (bool) ($integrationOptionsData['only_with_geofences'] ?? false);

        if (!$organisationId) {
            throw new \RuntimeException('MiX organisation_id is required to import locations.');
        }

        $client = Http::baseUrl($baseUrl)
            ->acceptJson()
            ->withToken($token)
            ->timeout(120);

        $path = '/api/locations/group/' . $organisationId."?includeShape=true";

        $response = $client->get($path);

        if ($response->failed()) {
            Log::warning('Mix Integrate locations import request failed.', [
                'baseUrl' => $baseUrl,
                'path' => $path,
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        $raw = $response->json();
        if (!is_array($raw)) {
            return [];
        }

        $list = $raw['locations'] ?? $raw['Locations'] ?? $raw['data'] ?? $raw['items'] ?? $raw;
        if (!is_array($list)) {
            return [];
        }

        if (!array_is_list($list)) {
            $list = [$list];
        }

        $locations = [];
        $locationTypes = LocationType::query()
            ->where('merchant_id', $integrationData['merchant_id'] ?? null)
            ->get();

        foreach ($list as $item) {
            if (!is_array($item)) {
                continue;
            }

            if(($item['isDeleted'] ?? $item['IsDeleted'] ?? false) === true) {
                continue;
            }

            if ($onlyWithGeofences && !$this->mixLocationHasGeofence($item)) {
                continue;
            }

            $locationId = $item['locationId']
                ?? $item['LocationId']
                ?? $item['siteId']
                ?? $item['SiteId']
                ?? $item['id']
                ?? $item['Id']
                ?? null;

            if ($locationId === null || $locationId === '') {
                continue;
            }

            $shapeWkt = $item['ShapeWkt'] ?? $item['shapeWkt'] ?? null;
            $latitude = $item['latitude'] ?? $item['Latitude'] ?? null;
            $longitude = $item['longitude'] ?? $item['Longitude'] ?? null;

            if (!is_numeric($latitude) || !is_numeric($longitude)) {
                $derivedCenter = $this->extractPolygonCentroid($shapeWkt);
                if ($derivedCenter !== null) {
                    $latitude = $derivedCenter['latitude'];
                    $longitude = $derivedCenter['longitude'];
                }
            }

            $location_type_id = "";
            if (!empty($item['LocationType'])) {
                $locationType = $locationTypes->firstWhere('title', $item['LocationType']);
                
                if (!$locationType) {
                    $merchantId = (int) ($integrationData['merchant_id'] ?? 0);
                    $accountId = (int) ($integrationData['account_id'] ?? 0);
                    $title = trim((string) $item['LocationType']);

                    if ($merchantId > 0 && $accountId > 0 && $title !== '') {
                        $slug = $this->generateUniqueLocationTypeSlug($merchantId, $title);
                        $nextSequence = ((int) LocationType::query()
                            ->where('merchant_id', $merchantId)
                            ->max('sequence')) + 1;

                        $locationType = LocationType::create([
                            'account_id' => $accountId,
                            'merchant_id' => $merchantId,
                            'slug' => $slug,
                            'title' => $title,
                            'collection_point' => false,
                            'delivery_point' => false,
                            'sequence' => $nextSequence,
                            'default' => false,
                        ]);
                        $locationTypes->push($locationType);
                    }
                }

                if ($locationType) {
                    $location_type_id = $locationType->id;
                }
            }

            if($shapeWkt){
                Log::info('Location with geofence found.', [
                    'locationId' => $locationId,
                    'shapeWkt' => $shapeWkt,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                ]);
            }

            
            $locations[] = [
                'integration_id' => (string) $locationId,
                'name' => $item['name']
                    ?? $item['Name']
                    ?? $item['description']
                    ?? $item['Description']
                    ?? null,
                'code' => $item['code']
                    ?? $item['Code']
                    ?? $item['siteCode']
                    ?? $item['SiteCode']
                    ?? null,
                'polygon_bounds' => $shapeWkt,
                'company' => $item['company'] ?? $item['Company'] ?? null,
                'full_address' => $item['Address'] ?? $item['address'] ?? null,
                'latitude' => is_numeric($latitude) ? (float) $latitude : null,
                'longitude' => is_numeric($longitude) ? (float) $longitude : null,
                'google_place_id' => $item['googlePlaceId'] ?? $item['GooglePlaceId'] ?? null,
                'phone' => $item['contactDetails']['MobilePhone'] ?? $item['ContactDetails']['mobilePhone'] ?? $item['contactDetails']['HomePhone'] ?? $item['ContactDetails']['homePhone'] ?? $item['contactDetails']['WorkPhone'] ?? $item['ContactDetails']['workPhone'] ?? null,
                'first_name' => $item['contactDetails']['ContactName'] ?? $item['ContactDetails']['contactName'] ?? null,
                'email'=> $item['contactDetails']['Email'] ?? $item['ContactDetails']['email'] ?? null,
                'location_type_id' => $location_type_id,
                'provider_payload' => $item,
            ];
        }

        return $locations;
    }

    private function generateUniqueLocationTypeSlug(int $merchantId, string $title): string
    {
        $baseSlug = Str::slug($title);
        if ($baseSlug === '') {
            $baseSlug = 'type';
        }

        $slug = $baseSlug;
        $suffix = 2;

        while (LocationType::query()
            ->where('merchant_id', $merchantId)
            ->where('slug', $slug)
            ->exists()) {
            $slug = $baseSlug . '-' . $suffix;
            $suffix++;
        }

        return $slug;
    }

    private function mixLocationHasGeofence(array $item): bool
    {
        $shapeWkt = $item['ShapeWkt'] ?? $item['shapeWkt'] ?? null;
        if (is_string($shapeWkt) && trim($shapeWkt) !== '') {
            return true;
        }

        $radius = $item['Radius'] ?? $item['radius'] ?? null;
        if (is_numeric($radius) && (float) $radius > 0) {
            return true;
        }

        return false;
    }

    private function extractPolygonCentroid($shapeWkt): ?array
    {
        if (!is_string($shapeWkt)) {
            return null;
        }

        $shapeWkt = trim($shapeWkt);
        if ($shapeWkt === '' || !preg_match('/^POLYGON\\s*\\(\\((.+)\\)\\)$/i', $shapeWkt, $matches)) {
            return null;
        }

        $pairs = array_filter(array_map('trim', explode(',', $matches[1])));
        $points = [];

        foreach ($pairs as $pair) {
            $segments = preg_split('/\\s+/', $pair);
            if (count($segments) !== 2 || !is_numeric($segments[0]) || !is_numeric($segments[1])) {
                continue;
            }

            // WKT is "longitude latitude".
            $points[] = [(float) $segments[0], (float) $segments[1]];
        }

        if (count($points) < 3) {
            return null;
        }

        $first = $points[0];
        $last = $points[count($points) - 1];
        if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
            $points[] = $first;
        }

        $area2 = 0.0;
        $centroidX = 0.0;
        $centroidY = 0.0;
        $count = count($points);

        for ($i = 0; $i < $count - 1; $i++) {
            $x0 = $points[$i][0];
            $y0 = $points[$i][1];
            $x1 = $points[$i + 1][0];
            $y1 = $points[$i + 1][1];
            $cross = ($x0 * $y1) - ($x1 * $y0);
            $area2 += $cross;
            $centroidX += ($x0 + $x1) * $cross;
            $centroidY += ($y0 + $y1) * $cross;
        }

        if (abs($area2) < 1e-12) {
            $sumX = 0.0;
            $sumY = 0.0;
            $uniqueCount = $count - 1;

            for ($i = 0; $i < $uniqueCount; $i++) {
                $sumX += $points[$i][0];
                $sumY += $points[$i][1];
            }

            if ($uniqueCount <= 0) {
                return null;
            }

            return [
                'longitude' => $sumX / $uniqueCount,
                'latitude' => $sumY / $uniqueCount,
            ];
        }

        $factor = 1 / (3 * $area2);

        return [
            'longitude' => $centroidX * $factor,
            'latitude' => $centroidY * $factor,
        ];
    }

    private function mapPosition(array $item): array
    {
        /*Item example
        [
            "PositionId"=>2626789689025102000,
            "AssetId"=>-2125258503986610200,
            "DriverId"=>159419850580557820,
            "Timestamp"=>"2026-02-22T15:55:40Z",
            "Latitude"=>10.1006545,
            "Longitude"=>-16.94967136,
            "SpeedKilometresPerHour"=>74,
            "SpeedLimit"=>60,
            "AltitudeMetres"=>533,
            "Heading"=>336,
            "NumberOfSatellites"=>9,
            "Hdop"=>2,
            "Vdop"=>0,
            "Pdop"=>0,
            "AgeOfReadingSeconds"=>0,
            "DistanceSinceReadingKilometres"=>0,
            "OdometerKilometres"=>31759.9121,
            "FormattedAddress"=>"string",
            "Source"=>"Gps",
            "IsAvl"=>true
        ]*/
            
        $assetId = $item['AssetId'] ?? $item['assetId'] ?? $item['asset_id'] ?? null;
        $assetId = $this->formatMixAssetId($assetId);

        return [
            'timestamp' => $item['timestamp'] ?? $item['Timestamp'] ?? null,
            'longitude' => $item['longitude'] ?? $item['Longitude'] ?? null,
            'latitude' => $item['latitude'] ?? $item['Latitude'] ?? null,
            'speed_kilometres_per_hour' => $item['speedKilometresPerHour'] ?? $item['SpeedKilometresPerHour'] ?? null,
            'speed_limit' => $item['speedLimit'] ?? $item['SpeedLimit'] ?? null,
            'driver_integration_id' => $item['driver_integration_id'] ?? $item['DriverId'] ?? null,
            'vehicle_integration_id' => $assetId ?? null,
            'formatted_address' => $item['FormattedAddress'] ?? $item['formattedAddress'] ?? null,
            'odometer_kilometres' => $item['odometer_kilometres'] ?? $item['OdometerKilometres'] ?? null,
        ];
    }

    private function formatMixAssetId($assetId): ?string
    {
        if ($assetId === null || $assetId === '') {
            return null;
        }

        $raw = str_replace('_', '', (string) $assetId);
        $len = strlen($raw);

        if ($len <= 1) {
            return $raw;
        }

        $half = (int) floor($len / 2);

        return substr($raw, 0, $half) . '_' . substr($raw, $half);
    }

    private function getBearerToken(array $integrationData = []): string
    {
        $clientId = $integrationData['client_id'] ?? config('services.mix.client_id');
        $clientSecret = $integrationData['client_secret'] ?? config('services.mix.client_secret');
        $username = $integrationData['username'] ?? config('services.mix.username');
        $password = $integrationData['password'] ?? config('services.mix.password');
        $identityUrl = $integrationData['identity_server_url'] ?? config('services.mix.identity_url');

        $response = Http::asForm()
            ->acceptJson()
            ->timeout(20)
            ->post($identityUrl . '/connect/token', [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'grant_type' => 'password',
                'username' => $username,
                'password' => $password,
                'scope' => 'offline_access MiX.Integrate',
            ]);

        if ($response->failed()) {
            Log::warning('Mix Integrate token request failed.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);

            $response->throw();
        }

        $data = $response->json() ?? [];
        $token = $data['access_token'] ?? null;

        if (!$token) {
            throw new \RuntimeException('Mix Integrate access token missing from response.');
        }

        return $token;
    }
}
