<?php

namespace App\Services;

use App\Jobs\ImportProviderDriversJob;
use App\Jobs\ImportProviderLocationsJob;
use App\Jobs\ImportProviderVehiclesJob;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Location;
use App\Models\TrackingProvider;
use App\Models\TrackingProviderIntegrationFormField;
use App\Models\TrackingProviderOption;
use App\Models\Vehicle;
use App\Models\VehicleType;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Illuminate\Support\Str;

class MerchantIntegrationService
{
    private const IMPORT_TYPES = ['locations', 'drivers', 'vehicles'];

    public function __construct(private ActivityLogService $activityLogService)
    {
    }

    public function activateProvider(
        User $user,
        string $providerUuid,
        array $integrationData,
        ?string $merchantUuid = null
    ): MerchantIntegration
    {
        $merchant = $merchantUuid
            ? $this->resolveAuthorizedMerchant($user, $merchantUuid)
            : $this->resolveMerchant($user);

        if (!$merchant) {
            throw ValidationException::withMessages([
                'merchant_id' => 'Merchant profile not found.',
            ]);
        }

        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        if ($provider->status !== 'active') {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is disabled.',
            ]);
        }

        $fields = TrackingProviderIntegrationFormField::where('provider_id', $provider->id)
            ->orderBy('order_id')
            ->get();

        $this->validateIntegrationData($fields, $integrationData);

        return MerchantIntegration::updateOrCreate(
            [
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'provider_id' => $provider->id,
            ],
            [
                'integration_data' => $integrationData,
            ]
        );
    }

    public function updateProviderOptionsData(User $user, string $providerUuid, string $merchantUuid, array $integrationOptionsData): MerchantIntegration
    {
        $merchant = Merchant::where('uuid', $merchantUuid)->first();
        if (!$merchant) {
            throw ValidationException::withMessages([
                'merchant_id' => 'Merchant not found.',
            ]);
        }

        $belongsToUser = $user->merchants()->where('merchants.id', $merchant->id)->exists()
            || $user->ownedMerchants()->where('id', $merchant->id)->exists();

        if (!$belongsToUser) {
            throw ValidationException::withMessages([
                'merchant_id' => 'You are not authorized for this merchant.',
            ]);
        }

        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        if (!$integration) {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is not activated for this merchant.',
            ]);
        }

        $options = TrackingProviderOption::where('provider_id', $provider->id)
            ->orderBy('order_id')
            ->get();

        $this->validateIntegrationOptionsData($options, $integrationOptionsData);

        $integration->integration_options_data = $integrationOptionsData;
        $integration->save();

        return $integration;
    }

    public function queueProviderVehiclesImport(
        User $user,
        string $providerUuid,
        string $merchantUuid,
        array $vehicles
    ): array
    {
        $merchant = $this->resolveAuthorizedMerchant($user, $merchantUuid);
        $this->ensureProviderSupportsImport($merchant, $providerUuid, 'import_vehicles', 'vehicles');
        $normalizedVehicles = $this->normalizeSelectedProviderVehicles($vehicles);

        if (empty($normalizedVehicles)) {
            throw ValidationException::withMessages([
                'vehicles' => 'Please select at least one vehicle to import.',
            ]);
        }

        $start = $this->startImportInProgress($merchant->id, 'vehicles');
        if (!$start['started']) {
            return [
                'queued' => false,
                'already_in_progress' => true,
                'stats' => $start['stats'],
            ];
        }

        ImportProviderVehiclesJob::dispatch(
            $user->id,
            $merchant->id,
            $merchant->uuid,
            $providerUuid,
            $normalizedVehicles
        );

        return [
            'queued' => true,
            'already_in_progress' => false,
            'stats' => $start['stats'],
        ];
    }

    public function listProviderVehicles(User $user, string $providerUuid, string $merchantUuid): array
    {
        [$merchant, $provider, $integration, $providerService] = $this->resolveVehicleImportContext(
            $user,
            $providerUuid,
            $merchantUuid
        );

        $payload = $this->fetchProviderVehiclePayload($provider, $integration, $merchant, $providerService);
        $vehicles = [];

        foreach ($payload as $item) {
            if (!is_array($item)) {
                continue;
            }

            $normalized = $this->normalizeProviderVehiclePreviewItem($item);
            if ($normalized === null) {
                continue;
            }

            $vehicles[] = $normalized;
        }

        usort($vehicles, function (array $left, array $right): int {
            $leftLabel = trim(($left['plate_number'] ?? '').' '.($left['description'] ?? ''));
            $rightLabel = trim(($right['plate_number'] ?? '').' '.($right['description'] ?? ''));

            return strcasecmp($leftLabel, $rightLabel);
        });

        return $vehicles;
    }

    public function queueProviderDriversImport(User $user, string $providerUuid, string $merchantUuid): array
    {
        $merchant = $this->resolveAuthorizedMerchant($user, $merchantUuid);
        $this->ensureProviderSupportsImport($merchant, $providerUuid, 'import_drivers', 'drivers');

        $start = $this->startImportInProgress($merchant->id, 'drivers');
        if (!$start['started']) {
            return [
                'queued' => false,
                'already_in_progress' => true,
                'stats' => $start['stats'],
            ];
        }

        ImportProviderDriversJob::dispatch(
            $user->id,
            $merchant->id,
            $merchant->uuid,
            $providerUuid
        );

        return [
            'queued' => true,
            'already_in_progress' => false,
            'stats' => $start['stats'],
        ];
    }

    public function queueProviderLocationsImport(
        User $user,
        string $providerUuid,
        string $merchantUuid,
        ?bool $onlyWithGeofences = null
    ): array {
        $merchant = $this->resolveAuthorizedMerchant($user, $merchantUuid);
        $this->ensureProviderSupportsImport($merchant, $providerUuid, 'import_locations', 'locations');

        $start = $this->startImportInProgress($merchant->id, 'locations');
        if (!$start['started']) {
            return [
                'queued' => false,
                'already_in_progress' => true,
                'stats' => $start['stats'],
            ];
        }

        Log::info('Before dispatching ImportProviderLocationsJob', [
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'provider_uuid' => $providerUuid,
            'only_with_geofences' => $onlyWithGeofences,
        ]);
        ImportProviderLocationsJob::dispatch(
            $user->id,
            $merchant->id,
            $merchant->uuid,
            $providerUuid,
            $onlyWithGeofences
        );
        Log::info('After dispatching ImportProviderLocationsJob', [
            'user_id' => $user->id,
            'merchant_id' => $merchant->id,
            'provider_uuid' => $providerUuid,
            'only_with_geofences' => $onlyWithGeofences,
        ]);

        return [
            'queued' => true,
            'already_in_progress' => false,
            'stats' => $start['stats'],
        ];
    }

    public function getImportStatuses(User $user, string $merchantUuid): array
    {
        $merchant = $this->resolveAuthorizedMerchant($user, $merchantUuid);

        return $this->normalizeImportStats($merchant->imports_stats);
    }

    public function completeImportByMerchantId(int $merchantId, string $type, ?int $count = null, ?string $error = null): void
    {
        if (!in_array($type, self::IMPORT_TYPES, true)) {
            return;
        }

        DB::transaction(function () use ($merchantId, $type, $count, $error): void {
            $merchant = Merchant::query()->whereKey($merchantId)->lockForUpdate()->first();
            if (!$merchant) {
                return;
            }

            $stats = $this->normalizeImportStats($merchant->imports_stats);
            $stats['inprogress'][$type] = null;
            if ($count !== null) {
                $stats['last_import_counts'][$type] = max(0, $count);
            }
            $stats['last_import_errors'][$type] = $error !== null && trim($error) !== ''
                ? Str::limit($error, 2000, '')
                : null;

            $merchant->imports_stats = $stats;
            $merchant->save();
        });
    }

    public function importProviderVehicles(
        User $user,
        string $providerUuid,
        string $merchantUuid,
        array $selectedVehicles
    ): array {
        [$merchant, $provider, $integration, $providerService] = $this->resolveVehicleImportContext(
            $user,
            $providerUuid,
            $merchantUuid
        );

        $normalizedVehicles = $this->normalizeSelectedProviderVehicles($selectedVehicles);
        if (empty($normalizedVehicles)) {
            throw ValidationException::withMessages([
                'vehicles' => 'Please select at least one vehicle to import.',
            ]);
        }

        $payload = $this->fetchProviderVehiclePayload($provider, $integration, $merchant, $providerService);

        if (!is_array($payload)) {
            $payload = [];
        }

        $imported = [];
        $importedAt = now();
        $selectedVehicleLookup = [];
        foreach ($normalizedVehicles as $selectedVehicle) {
            $selectedVehicleLookup[$selectedVehicle['provider_vehicle_id']] = $selectedVehicle;
        }

        foreach ($payload as $item) {
            if (!is_array($item)) {
                continue;
            }

            $previewVehicle = $this->normalizeProviderVehiclePreviewItem($item);
            if ($previewVehicle === null) {
                continue;
            }

            $integrationId = $previewVehicle['provider_vehicle_id'];
            if (!isset($selectedVehicleLookup[$integrationId])) {
                continue;
            }

            $selectedVehicle = $selectedVehicleLookup[$integrationId];

            $vehicle = Vehicle::query()
                ->where('account_id', $integration->account_id)
                ->where(function ($query) use ($merchant) {
                    $query->where('merchant_id', $merchant->id)
                        ->orWhereNull('merchant_id');
                })
                ->where('intergration_id', $integrationId)
                ->first();

            if (!$vehicle) {
                $vehicle = new Vehicle();
                $vehicle->account_id = $integration->account_id;
                $vehicle->merchant_id = $merchant->id;
                $vehicle->intergration_id = $integrationId;
                $vehicle->is_active = true;
            }

            $vehicle->merchant_id = $merchant->id;
            $vehicle->vehicle_type_id = $selectedVehicle['vehicle_type_id'];
            $vehicle->make = $item['make'] ?? $vehicle->make;
            $vehicle->model = $item['model'] ?? $vehicle->model;
            $vehicle->color = $item['color'] ?? $vehicle->color;
            $vehicle->plate_number = $item['plate_number'] ?? $vehicle->plate_number;
            $vehicle->vin_number = $item['vin_number'] ?? $vehicle->vin_number;
            $vehicle->engine_number = $item['engine_number'] ?? $vehicle->engine_number;
            $vehicle->ref_code = $item['ref_code'] ?? $vehicle->ref_code;
            $vehicle->odometer = $item['odometer'] ?? $vehicle->odometer;
            $vehicle->year = $item['year'] ?? $vehicle->year;
            $vehicle->imported_at = $importedAt;
            $vehicle->metadata = $this->mergeMetadata($vehicle->metadata, [
                'provider' => Str::slug($provider->name),
                'imported_at' => now()->toIso8601String(),
                'driver_integration_id' => $item['driver_integration_id'] ?? null,
                'provider_payload' => $item['provider_payload'] ?? null,
            ]);

            $vehicle->save();
            $imported[] = $vehicle->fresh('vehicleType');
        }

        $importedCount = count($imported);
        $this->activityLogService->log(
            action: 'imported',
            entityType: 'vehicle',
            actor: $user,
            accountId: $integration->account_id,
            merchantId: $merchant->id,
            title: 'Vehicles imported from tracking provider',
            metadata: [
                'provider_id' => $providerUuid,
                'provider' => Str::slug($provider->name),
                'imported_count' => $importedCount,
                'selected_vehicles' => array_map(
                    fn (array $selectedVehicle) => [
                        'provider_vehicle_id' => $selectedVehicle['provider_vehicle_id'],
                        'vehicle_type_uuid' => $selectedVehicle['vehicle_type_uuid'],
                    ],
                    $normalizedVehicles
                ),
            ]
        );

        return [
            'imported_count' => $importedCount,
            'vehicles' => $imported,
        ];
    }

    public function importProviderDrivers(User $user, string $providerUuid, string $merchantUuid): array
    {
        $merchant = Merchant::where('uuid', $merchantUuid)->first();
        if (!$merchant) {
            throw ValidationException::withMessages([
                'merchant_id' => 'Merchant not found.',
            ]);
        }

        $belongsToUser = $user->merchants()->where('merchants.id', $merchant->id)->exists()
            || $user->ownedMerchants()->where('id', $merchant->id)->exists();

        if (!$belongsToUser) {
            throw ValidationException::withMessages([
                'merchant_id' => 'You are not authorized for this merchant.',
            ]);
        }

        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        if (!$integration) {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is not activated for this merchant.',
            ]);
        }

        $providerService = $this->resolveProviderService($provider);
        if (!$providerService || !method_exists($providerService, 'import_drivers')) {
            throw ValidationException::withMessages([
                'provider_id' => 'This provider does not support importing of drivers.',
            ]);
        }

        $payload = $providerService->import_drivers(
            $this->buildProviderIntegrationData($integration, $merchant),
            $integration->integration_options_data ?? []
        );

        if (!is_array($payload)) {
            $payload = [];
        }

        $carrierId = $this->getOrCreateMerchantCarrierId($merchant);
        $providerSlug = Str::slug($provider->name);
        $importedDriverIds = [];
        $itemsToImport = [];

        foreach ($payload as $item) {
            if (!is_array($item)) {
                continue;
            }

            $integrationId = $item['integration_id'] ?? null;
            if (!$integrationId) {
                continue;
            }

            $itemsToImport[] = [
                'integration_id' => (string) $integrationId,
                'item' => $item,
            ];
        }

        if (empty($itemsToImport)) {
            $this->activityLogService->log(
                action: 'imported',
                entityType: 'driver',
                actor: $user,
                accountId: $integration->account_id,
                merchantId: $merchant->id,
                title: 'Drivers imported from tracking provider',
                metadata: [
                    'provider_id' => $providerUuid,
                    'provider' => Str::slug($provider->name),
                    'imported_count' => 0,
                ]
            );

            return ['imported_count' => 0, 'drivers' => []];
        }

        $integrationIds = array_values(array_unique(array_column($itemsToImport, 'integration_id')));
        $requestedEmails = [];

        $importedAt = now();
        foreach ($itemsToImport as $entry) {
            $candidate = $entry['item']['email'] ?? null;
            if (is_string($candidate) && $candidate !== '') {
                $requestedEmails[] = $candidate;
            }
        }

        $existingDriversByIntegrationId = Driver::query()
            ->with('user')
            ->where(function (Builder $builder) use ($integration, $merchant) {
                $builder->where('merchant_id', $merchant->id)
                    ->orWhere(function (Builder $legacyBuilder) use ($integration) {
                        $legacyBuilder->whereNull('merchant_id')
                            ->where('account_id', $integration->account_id);
                    });
            })
            ->whereIn('intergration_id', $integrationIds)
            ->get()
            ->keyBy(fn (Driver $driver) => (string) $driver->intergration_id);

        $knownEmailOwners = [];
        $accountUsersByEmail = [];
        if (!empty($requestedEmails)) {
            $uniqueEmails = array_values(array_unique($requestedEmails));

            $users = User::query()
                ->whereIn('email', $uniqueEmails)
                ->get();

            foreach ($users as $knownUser) {
                $emailKey = Str::lower((string) $knownUser->email);
                $knownEmailOwners[$emailKey] = (int) $knownUser->id;

                if ((int) $knownUser->account_id === (int) $integration->account_id) {
                    $accountUsersByEmail[$emailKey] = $knownUser;
                }
            }
        }
        foreach ($itemsToImport as $entry) {
            $integrationId = $entry['integration_id'];
            $item = $entry['item'];
            $driver = $existingDriversByIntegrationId->get($integrationId);

            $email = $item['email'] ?? null;
            if (!$email) {
                $email = $this->buildImportedDriverEmailFast($providerSlug, $integrationId, $knownEmailOwners);
            }

            if (!$driver) {
                $driver = new Driver();
                $driver->account_id = $integration->account_id;
                $driver->merchant_id = $merchant->id;
                $driver->intergration_id = $integrationId;
                $existingDriversByIntegrationId->put($integrationId, $driver);
            }

            $userModel = $driver->user;
            if (!$userModel) {
                $emailKey = Str::lower((string) $email);
                $userModel = $accountUsersByEmail[$emailKey] ?? null;

                if (!$userModel && $this->isEmailTakenByOther($email, null, $knownEmailOwners)) {
                    $email = $this->buildImportedDriverEmailFast($providerSlug, $integrationId, $knownEmailOwners);
                }

                if (!$userModel) {
                    $userModel = new User();
                    $userModel->email = $email;
                    $userModel->password = Str::random(48);
                }
            }

            $userModel->account_id = $integration->account_id;
            $userModel->name = $item['name'] ?? $userModel->name ?? 'Imported Driver '.$integrationId;
            $userModel->telephone = $item['telephone'] ?? $userModel->telephone;
            $userModel->role = 'driver';

            if (($item['email'] ?? null) && $item['email'] !== $userModel->email) {
                $candidateEmail = $item['email'];
                if (!$this->isEmailTakenByOther($candidateEmail, $userModel->id, $knownEmailOwners)) {
                    $userModel->email = $candidateEmail;
                }
            }

            $userModel->save();
            $userEmailKey = Str::lower((string) $userModel->email);
            $knownEmailOwners[$userEmailKey] = (int) $userModel->id;
            $accountUsersByEmail[$userEmailKey] = $userModel;

            $driver->user_id = $userModel->id;
            $driver->merchant_id = $merchant->id;
            $driver->carrier_id = $carrierId;

            if (array_key_exists('is_active', $item)) {
                $driver->is_active = (bool) $item['is_active'];
            } elseif (!$driver->exists) {
                $driver->is_active = true;
            }

            if (array_key_exists('notes', $item)) {
                $driver->notes = $item['notes'];
            }
            $driver->imported_at = $importedAt;
            $driver->metadata = $this->mergeMetadata($driver->metadata, [
                'provider' => Str::slug($provider->name),
                'imported_at' => now()->toIso8601String(),
                'provider_payload' => $item['provider_payload'] ?? null,
            ]);

            $driver->save();
            $importedDriverIds[] = (int) $driver->id;
        }

        $loadedDrivers = Driver::query()
            ->with(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType'])
            ->whereIn('id', array_values(array_unique($importedDriverIds)))
            ->get()
            ->keyBy('id');

        $imported = [];
        foreach ($importedDriverIds as $driverId) {
            $driver = $loadedDrivers->get($driverId);
            if ($driver) {
                $imported[] = $driver;
            }
        }

        $importedCount = count($imported);
        $this->activityLogService->log(
            action: 'imported',
            entityType: 'driver',
            actor: $user,
            accountId: $integration->account_id,
            merchantId: $merchant->id,
            title: 'Drivers imported from tracking provider',
            metadata: [
                'provider_id' => $providerUuid,
                'provider' => Str::slug($provider->name),
                'imported_count' => $importedCount,
            ]
        );

        return [
            'imported_count' => $importedCount,
            'drivers' => $imported,
        ];
    }

    public function importProviderLocations(
        User $user,
        string $providerUuid,
        string $merchantUuid,
        ?bool $onlyWithGeofences = null
    ): array
    {
        $merchant = Merchant::where('uuid', $merchantUuid)->first();
        if (!$merchant) {
            throw ValidationException::withMessages([
                'merchant_id' => 'Merchant not found.',
            ]);
        }

        $belongsToUser = $user->merchants()->where('merchants.id', $merchant->id)->exists()
            || $user->ownedMerchants()->where('id', $merchant->id)->exists();

        if (!$belongsToUser) {
            throw ValidationException::withMessages([
                'merchant_id' => 'You are not authorized for this merchant.',
            ]);
        }

        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        if (!$integration) {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is not activated for this merchant.',
            ]);
        }

        $providerService = $this->resolveProviderService($provider);
        if (!$providerService || !method_exists($providerService, 'import_locations')) {
            throw ValidationException::withMessages([
                'provider_id' => 'This provider does not support importing of locations.',
            ]);
        }

        $integrationOptions = $integration->integration_options_data ?? [];
        if ($onlyWithGeofences !== null) {
            $integrationOptions['only_with_geofences'] = $onlyWithGeofences;
        }

        $payload = $providerService->import_locations(
            $this->buildProviderIntegrationData($integration, $merchant),
            $integrationOptions
        );

        if (!is_array($payload)) {
            $payload = [];
        }

        $imported = [];
        $importedAt = now();
        foreach ($payload as $item) {
            if (!is_array($item)) {
                continue;
            }

            $integrationId = $item['integration_id'] ?? null;
            if (!$integrationId) {
                continue;
            }

            $location = Location::query()
                ->where('account_id', $integration->account_id)
                ->where('merchant_id', $merchant->id)
                ->where('intergration_id', (string) $integrationId)
                ->first();

            if (!$location) {
                $location = new Location();
                $location->account_id = $integration->account_id;
                $location->merchant_id = $merchant->id;
                $location->intergration_id = (string) $integrationId;
            }

            $fallbackLabel = 'Imported Location '.(string) $integrationId;
    
            $location->location_type_id = $item['location_type_id'] ?? $location->location_type_id;
            $location->name = $item['name'] ?? $location->name ?? $fallbackLabel;
            $location->code = $item['code'] ?? $location->code ?? null;
            $location->company = $item['company'] ?? $location->company;
            $location->full_address = $item['full_address'] ?? $location->full_address;
            $location->address_line_1 = $item['address_line_1'] ?? $location->address_line_1;
            $location->address_line_2 = $item['address_line_2'] ?? $location->address_line_2;
            $location->town = $item['town'] ?? $location->town;
            $location->city = $item['city'] ?? $location->city ?? null;
            $location->country = $item['country'] ?? $location->country;
            $location->first_name = $item['first_name'] ?? $location->first_name;
            $location->last_name = $item['last_name'] ?? $location->last_name;
            $location->phone = $item['phone'] ?? $location->phone;
            $location->email = $item['email'] ?? $location->email;
            $location->province = $item['province'] ?? $location->province ?? null;
            $location->post_code = $item['post_code'] ?? $location->post_code ?? null;
            $location->google_place_id = $item['google_place_id'] ?? $location->google_place_id;
            $location->imported_at = $importedAt;
            $location->metadata = $this->mergeMetadata($location->metadata, [
                'provider' => Str::slug($provider->name),
                'imported_at' => now()->toIso8601String(),
                'provider_payload' => $item['provider_payload'] ?? null,
            ]);

            if (array_key_exists('latitude', $item) && is_numeric($item['latitude'])) {
                $location->latitude = $item['latitude'];
            }
            if (array_key_exists('longitude', $item) && is_numeric($item['longitude'])) {
                $location->longitude = $item['longitude'];
            }

            $location->save();
            if (array_key_exists('polygon_bounds', $item)) {
                $this->applyPolygonBounds($location, $item['polygon_bounds']);
            }

            $imported[] = $location->fresh();
        }

        $importedCount = count($imported);
        $this->activityLogService->log(
            action: 'imported',
            entityType: 'location',
            actor: $user,
            accountId: $integration->account_id,
            merchantId: $merchant->id,
            title: 'Locations imported from tracking provider',
            metadata: [
                'provider_id' => $providerUuid,
                'provider' => Str::slug($provider->name),
                'imported_count' => $importedCount,
                'only_with_geofences' => $integrationOptions['only_with_geofences'] ?? null,
            ]
        );

        return [
            'imported_count' => $importedCount,
            'locations' => $imported,
        ];
    }

    private function applyPolygonBounds(Location $location, mixed $polygonBounds): void
    {
        if ($polygonBounds === null) {
            $location->polygon_bounds = null;
            $location->save();

            return;
        }

        if (!is_string($polygonBounds)) {
            return;
        }

        $wkt = trim($polygonBounds);
        if ($wkt === '') {
            $location->polygon_bounds = null;
            $location->save();

            return;
        }

        if (!preg_match('/^POLYGON\\s*\\(\\((.+)\\)\\)$/i', $wkt)) {
            Log::warning('Skipping invalid polygon_bounds WKT during location import.', [
                'location_id' => $location->id,
                'intergration_id' => $location->intergration_id,
            ]);

            return;
        }

        if (DB::connection()->getDriverName() === 'sqlite') {
            Location::query()->whereKey($location->id)->update([
                'polygon_bounds' => $wkt,
            ]);

            return;
        }

        $safeWkt = str_replace("'", "''", $wkt);
        Location::query()->whereKey($location->id)->update([
            'polygon_bounds' => DB::raw("ST_GeomFromText('{$safeWkt}')"),
        ]);
    }

    private function resolveVehicleImportContext(
        User $user,
        string $providerUuid,
        string $merchantUuid
    ): array {
        $merchant = $this->resolveAuthorizedMerchant($user, $merchantUuid);
        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        if (!$integration) {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is not activated for this merchant.',
            ]);
        }

        $providerService = $this->resolveProviderService($provider);
        if (!$providerService || !method_exists($providerService, 'import_vehicles')) {
            throw ValidationException::withMessages([
                'provider_id' => 'This provider does not support importing of vehicles.',
            ]);
        }

        return [$merchant, $provider, $integration, $providerService];
    }

    private function fetchProviderVehiclePayload(
        TrackingProvider $provider,
        MerchantIntegration $integration,
        Merchant $merchant,
        object $providerService
    ): array {
        $integrationData = $this->buildProviderIntegrationData($integration, $merchant);
        $integrationOptions = $integration->integration_options_data ?? [];

        $payload = method_exists($providerService, 'list_importable_vehicles')
            ? $providerService->list_importable_vehicles($integrationData, $integrationOptions)
            : $providerService->import_vehicles($integrationData, $integrationOptions);

        if (!is_array($payload)) {
            return [];
        }

        return $payload;
    }

    private function normalizeProviderVehiclePreviewItem(array $item): ?array
    {
        $integrationId = $item['integration_id'] ?? null;
        if ($integrationId === null || $integrationId === '') {
            return null;
        }

        return [
            'provider_vehicle_id' => (string) $integrationId,
            'plate_number' => $item['plate_number'] ?? null,
            'description' => $item['description'] ?? $item['ref_code'] ?? null,
            'make' => $item['make'] ?? null,
            'model' => $item['model'] ?? null,
        ];
    }

    private function normalizeSelectedProviderVehicles(array $vehicles): array
    {
        $normalized = [];

        foreach ($vehicles as $vehicle) {
            if (!is_array($vehicle)) {
                continue;
            }

            $providerVehicleId = trim((string) ($vehicle['provider_vehicle_id'] ?? ''));
            $vehicleTypeUuid = trim((string) ($vehicle['vehicle_type_id'] ?? ''));

            if ($providerVehicleId === '' || $vehicleTypeUuid === '') {
                continue;
            }

            $vehicleTypeId = VehicleType::query()
                ->where('uuid', $vehicleTypeUuid)
                ->orWhere('id', is_numeric($vehicleTypeUuid) ? (int) $vehicleTypeUuid : 0)
                ->value('id');
            if (!$vehicleTypeId) {
                throw ValidationException::withMessages([
                    'vehicle_type_id' => 'vehicle_type_id does not exist.',
                ]);
            }

            $normalized[$providerVehicleId] = [
                'provider_vehicle_id' => $providerVehicleId,
                'vehicle_type_id' => (int) $vehicleTypeId,
                'vehicle_type_uuid' => $vehicleTypeUuid,
            ];
        }

        return array_values($normalized);
    }

    private function resolveAuthorizedMerchant(User $user, string $merchantUuid): Merchant
    {
        $merchant = Merchant::where('uuid', $merchantUuid)->first();
        if (!$merchant) {
            throw ValidationException::withMessages([
                'merchant_id' => 'Merchant not found.',
            ]);
        }

        $belongsToUser = $user->merchants()->where('merchants.id', $merchant->id)->exists()
            || $user->ownedMerchants()->where('id', $merchant->id)->exists();

        if (!$belongsToUser) {
            throw ValidationException::withMessages([
                'merchant_id' => 'You are not authorized for this merchant.',
            ]);
        }

        return $merchant;
    }

    private function ensureProviderSupportsImport(
        Merchant $merchant,
        string $providerUuid,
        string $providerMethod,
        string $errorSuffix
    ): void {
        $provider = TrackingProvider::where('uuid', $providerUuid)->firstOrFail();

        $integration = MerchantIntegration::query()
            ->where('merchant_id', $merchant->id)
            ->where('provider_id', $provider->id)
            ->first();

        if (!$integration) {
            throw ValidationException::withMessages([
                'provider_id' => 'Tracking provider is not activated for this merchant.',
            ]);
        }

        $capabilityColumn = match ($providerMethod) {
            'import_vehicles' => 'has_vehicle_importing',
            'import_drivers' => 'has_driver_importing',
            'import_locations' => 'has_locations_importing',
            default => null,
        };

        if ($capabilityColumn && !$provider->{$capabilityColumn}) {
            throw ValidationException::withMessages([
                'provider_id' => "This provider does not support importing of {$errorSuffix}.",
            ]);
        }

        $providerService = $this->resolveProviderService($provider);
        if (!$providerService || !method_exists($providerService, $providerMethod)) {
            throw ValidationException::withMessages([
                'provider_id' => "This provider does not support importing of {$errorSuffix}.",
            ]);
        }
    }

    private function startImportInProgress(int $merchantId, string $type): array
    {
        if (!in_array($type, self::IMPORT_TYPES, true)) {
            return [
                'started' => false,
                'stats' => $this->normalizeImportStats(null),
            ];
        }

        return DB::transaction(function () use ($merchantId, $type): array {
            $merchant = Merchant::query()->whereKey($merchantId)->lockForUpdate()->firstOrFail();
            $stats = $this->normalizeImportStats($merchant->imports_stats);

            if (!empty($stats['inprogress'][$type])) {
                return [
                    'started' => false,
                    'stats' => $stats,
                ];
            }

            $stats['inprogress'][$type] = now()->format('Y-m-d H:i:s');
            $stats['last_import_errors'][$type] = null;
            $merchant->imports_stats = $stats;
            $merchant->save();

            return [
                'started' => true,
                'stats' => $stats,
            ];
        });
    }

    private function normalizeImportStats(mixed $stats): array
    {
        $normalized = [
            'inprogress' => [
                'locations' => null,
                'drivers' => null,
                'vehicles' => null,
            ],
            'last_import_counts' => [
                'locations' => 0,
                'drivers' => 0,
                'vehicles' => 0,
            ],
            'last_import_errors' => [
                'locations' => null,
                'drivers' => null,
                'vehicles' => null,
            ],
        ];

        if (!is_array($stats)) {
            return $normalized;
        }

        foreach (self::IMPORT_TYPES as $type) {
            $inprogress = $stats['inprogress'][$type] ?? null;
            $count = $stats['last_import_counts'][$type] ?? 0;
            $error = $stats['last_import_errors'][$type] ?? null;

            $normalized['inprogress'][$type] = is_string($inprogress) && $inprogress !== '' ? $inprogress : null;
            $normalized['last_import_counts'][$type] = is_numeric($count) ? max(0, (int) $count) : 0;
            $normalized['last_import_errors'][$type] = is_string($error) && trim($error) !== '' ? $error : null;
        }

        return $normalized;
    }

    private function resolveProviderService(TrackingProvider $provider): ?object
    {
        $key = Str::slug($provider->name);
        $serviceClass = config("tracking_providers.services.{$key}");

        if (!$serviceClass || !class_exists($serviceClass)) {
            return null;
        }

        return app($serviceClass);
    }

    private function buildProviderIntegrationData(MerchantIntegration $integration, Merchant $merchant): array
    {
        $payload = $integration->integration_data ?? [];
        if (!is_array($payload)) {
            $payload = [];
        }

        $payload['account_id'] = $integration->account_id;
        $payload['merchant_id'] = $merchant->id;
        $payload['merchant_uuid'] = $merchant->uuid;

        return $payload;
    }

    private function resolveMerchant(User $user): ?Merchant
    {
        $merchant = $user->merchants()->orderBy('merchants.id')->first();
        if (!$merchant) {
            $merchant = $user->ownedMerchants()->orderBy('id')->first();
        }

        return $merchant;
    }

    private function getOrCreateMerchantCarrierId(Merchant $merchant): int
    {
        $existingId = Carrier::where('merchant_id', $merchant->id)->value('id');
        if ($existingId) {
            return (int) $existingId;
        }

        $carrier = Carrier::create([
            'merchant_id' => $merchant->id,
            'code' => 'mrc_'.$merchant->id.'_'.Str::lower(Str::random(6)),
            'name' => $merchant->name,
            'type' => 'internal',
            'enabled' => true,
        ]);

        return $carrier->id;
    }

    private function buildImportedDriverEmailFast(string $providerSlug, string $integrationId, array &$knownEmailOwners): string
    {
        $local = Str::slug($providerSlug.'-'.$integrationId, '-');
        if ($local === '') {
            $local = 'driver-'.Str::lower(Str::random(8));
        }

        $baseEmail = 'imported+'.substr($local, 0, 48).'@drivers.local';
        $email = $baseEmail;
        $suffix = 1;

        while ($this->isEmailTakenByOther($email, null, $knownEmailOwners)) {
            $email = 'imported+'.substr($local, 0, 44).'-'.$suffix.'@drivers.local';
            $suffix++;
        }

        return $email;
    }

    private function isEmailTakenByOther(?string $email, ?int $currentUserId, array &$knownEmailOwners): bool
    {
        if (!is_string($email) || $email === '') {
            return false;
        }

        $key = Str::lower($email);

        if (!array_key_exists($key, $knownEmailOwners)) {
            $ownerId = User::query()->where('email', $email)->value('id');
            $knownEmailOwners[$key] = $ownerId ? (int) $ownerId : null;
        }

        $ownerId = $knownEmailOwners[$key];
        if (!$ownerId) {
            return false;
        }

        if ($currentUserId && (int) $ownerId === (int) $currentUserId) {
            return false;
        }

        return true;
    }

    private function validateIntegrationData($fields, array $integrationData): void
    {
        $errors = [];

        foreach ($fields as $field) {
            $key = $field->name;
            $hasValue = array_key_exists($key, $integrationData);
            $value = $hasValue ? $integrationData[$key] : null;

            if ($field->is_required && !$hasValue) {
                $errors[$key] = 'This field is required.';
                continue;
            }

            if ($field->is_required && $value === null) {
                $errors[$key] = 'This field is required.';
                continue;
            }

            if (!$hasValue || $value === null) {
                continue;
            }

            if (in_array($field->type, ['text', 'password'], true) && !is_string($value)) {
                $errors[$key] = 'Must be a string.';
                continue;
            }

            if ($field->type === 'boolean') {
                $booleanValues = [true, false, 0, 1, '0', '1', 'true', 'false'];
                if (!in_array($value, $booleanValues, true)) {
                    $errors[$key] = 'Must be a boolean.';
                    continue;
                }
            }

            if ($field->type === 'select') {
                $options = $field->options ?? [];
                $allowed = [];
                foreach ($options as $option) {
                    if (is_array($option) && array_key_exists('value', $option)) {
                        $allowed[] = $option['value'];
                    } else {
                        $allowed[] = $option;
                    }
                }
                if ($allowed && !in_array($value, $allowed, true)) {
                    $errors[$key] = 'Invalid option selected.';
                }
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function validateIntegrationOptionsData($options, array $integrationOptionsData): void
    {
        $errors = [];
        $allowedKeys = $options->pluck('name')->all();

        foreach (array_keys($integrationOptionsData) as $key) {
            if (!in_array($key, $allowedKeys, true)) {
                $errors[$key] = 'Unknown option.';
            }
        }

        foreach ($options as $option) {
            $key = $option->name;
            if (!array_key_exists($key, $integrationOptionsData)) {
                continue;
            }

            $value = $integrationOptionsData[$key];
            if ($value === null) {
                continue;
            }

            if (in_array($option->type, ['text', 'password'], true) && !is_string($value)) {
                $errors[$key] = 'Must be a string.';
                continue;
            }

            if ($option->type === 'boolean') {
                $booleanValues = [true, false, 0, 1, '0', '1', 'true', 'false'];
                if (!in_array($value, $booleanValues, true)) {
                    $errors[$key] = 'Must be a boolean.';
                    continue;
                }
            }

            if ($option->type === 'select') {
                $allowed = [];
                foreach (($option->options ?? []) as $optionValue) {
                    if (is_array($optionValue) && array_key_exists('value', $optionValue)) {
                        $allowed[] = $optionValue['value'];
                    } else {
                        $allowed[] = $optionValue;
                    }
                }

                if ($allowed && !in_array($value, $allowed, true)) {
                    $errors[$key] = 'Invalid option selected.';
                }
            }
        }

        if (!empty($errors)) {
            throw ValidationException::withMessages($errors);
        }
    }

    private function mergeMetadata(?array $existing, array $updates): array
    {
        return array_merge($existing ?? [], array_filter(
            $updates,
            static fn ($value) => $value !== null
        ));
    }
}
