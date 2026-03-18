<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\RunShipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleType;
use Illuminate\Http\UploadedFile;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class VehicleService
{
    public function __construct(private ActivityLogService $activityLogService)
    {
    }

    public function listVehicles(User $user, array $filters): LengthAwarePaginator
    {
        $sortableColumns = [
            'created_at' => 'vehicles.created_at',
            'plate_number' => 'vehicles.plate_number',
            'make' => 'vehicles.make',
            'model' => 'vehicles.model',
            'is_active' => 'vehicles.is_active',
            'type' => 'vehicle_types.name',
        ];
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';

        $query = $this->buildScopedVehicleQuery($user, $filters)
            ->with(['merchant', 'vehicleType', 'lastDriver.user'])
            ->orderBy($sortColumn, $sortDirection)
            ->orderBy('vehicles.id');

        if ($sortBy === 'type') {
            $query->leftJoin('vehicle_types', 'vehicle_types.id', '=', 'vehicles.vehicle_type_id');
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where('vehicles.is_active', (bool) $filters['is_active']);
        }

        if (!empty($filters['vehicle_type_id'])) {
            $vehicleTypeId = VehicleType::where('uuid', $filters['vehicle_type_id'])->value('id');
            if ($vehicleTypeId) {
                $query->where('vehicles.vehicle_type_id', $vehicleTypeId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        // with_location_only
        if (!empty($filters['with_location_only'])) {
            $query->whereNotNull('vehicles.last_location_address');
        }

        // search
        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(' ', '%', $filters['search']) . '%';
            $query->where(function ($q) use ($searchTerm) {
                $q->where('vehicles.plate_number', 'like', $searchTerm)
                    ->orWhere('vehicles.make', 'like', $searchTerm)
                    ->orWhere('vehicles.model', 'like', $searchTerm)
                    ->orWhere('vehicles.vin_number', 'like', $searchTerm)
                    ->orWhere('vehicles.engine_number', 'like', $searchTerm)
                    ->orWhere('vehicles.ref_code', 'like', $searchTerm);
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->paginate($perPage);
    }

    public function getVehicle(User $user, string $vehicleUuid, array $filters = []): Vehicle
    {
        $query = $this->buildScopedVehicleQuery($user, $filters)
            ->with(['merchant', 'vehicleType', 'lastDriver.user'])
            ->where('uuid', $vehicleUuid);

        return $query->firstOrFail();
    }

    public function createVehicle(User $user, array $data): Vehicle
    {
        $merchant = $this->resolveVehicleMerchant($user, $data['merchant_id'] ?? null);
        $vehicleTypeId = null;
        if (!empty($data['vehicle_type_id'])) {
            $vehicleTypeId = VehicleType::where('uuid', $data['vehicle_type_id'])->value('id');
        }

        $vehicle = Vehicle::create([
            'account_id' => $merchant?->account_id ?? $user->account_id,
            'merchant_id' => $merchant?->id,
            'vehicle_type_id' => $vehicleTypeId,
            'make' => $data['make'] ?? null,
            'model' => $data['model'] ?? null,
            'color' => $data['color'] ?? null,
            'plate_number' => $data['plate_number'] ?? null,
            'vin_number' => $data['vin_number'] ?? null,
            'engine_number' => $data['engine_number'] ?? null,
            'ref_code' => $data['ref_code'] ?? null,
            'odometer' => $data['odometer'] ?? null,
            'year' => $data['year'] ?? null,
            'last_location_address' => $data['last_location_address'] ?? null,
            'location_updated_at' => $data['location_updated_at'] ?? null,
            'intergration_id' => $data['intergration_id'] ?? null,
            'photo_key' => $data['photo_key'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'metadata' => $data['metadata'] ?? null,
        ]);

        $this->activityLogService->log(
            action: 'created',
            entityType: 'vehicle',
            entity: $vehicle,
            actor: $user,
            accountId: $vehicle->account_id,
            merchantId: $vehicle->merchant_id,
            title: 'Vehicle created',
            changes: $this->activityLogService->diffChanges([], [
                'merchant_id' => $vehicle->merchant_id,
                'vehicle_type_id' => $vehicle->vehicle_type_id,
                'make' => $vehicle->make,
                'model' => $vehicle->model,
                'plate_number' => $vehicle->plate_number,
                'is_active' => (bool) $vehicle->is_active,
            ])
        );

        return $vehicle->load(['merchant', 'vehicleType', 'lastDriver.user']);
    }

    public function updateMaintenanceMode(User $user, string $vehicleUuid, array $data): Vehicle
    {
        $vehicle = $this->getVehicle($user, $vehicleUuid);
        $maintenanceMode = (bool) $data['maintenance_mode'];

        if ($maintenanceMode) {
            $vehicle->maintenance_mode_at = now();
            $vehicle->maintenance_expected_resolved_at = Carbon::parse($data['maintenance_expected_resolved_at']);
            $vehicle->maintenance_description = $data['maintenance_description'];
        } else {
            $vehicle->maintenance_mode_at = null;
            $vehicle->maintenance_expected_resolved_at = null;
            $vehicle->maintenance_description = null;
        }

        $vehicle->save();

        return $vehicle->load(['merchant', 'vehicleType', 'lastDriver.user']);
    }

    public function buildFleetStatusSummary(User $user, array $filters = []): array
    {
        $scopedVehicles = $this->buildScopedVehicleQuery($user, $filters);

        $maintenance = (clone $scopedVehicles)
            ->whereNotNull('maintenance_mode_at')
            ->count();

        $active = (clone $scopedVehicles)
            ->whereNull('maintenance_mode_at')
            ->whereHas('activeRuns.runShipments', function ($query) {
                $query
                    ->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('shipment', function ($shipmentQuery) {
                        $shipmentQuery->whereNotIn('status', ['delivered', 'cancelled']);
                    });
            })
            ->count();

        $total = (clone $scopedVehicles)->count();

        return [
            'active' => $active,
            'maintenance' => $maintenance,
            'standby' => max($total - $active - $maintenance, 0),
            'total' => $total,
        ];
    }

    public function updateVehicle(User $user, string $vehicleUuid, array $data): Vehicle
    {
        $vehicle = $this->getVehicle($user, $vehicleUuid);
        $before = $vehicle->only([
            'merchant_id',
            'vehicle_type_id',
            'make',
            'model',
            'color',
            'plate_number',
            'vin_number',
            'engine_number',
            'ref_code',
            'odometer',
            'year',
            'last_location_address',
            'location_updated_at',
            'intergration_id',
            'photo_key',
            'is_active',
            'metadata',
        ]);

        if (array_key_exists('last_location_address', $data) && !array_key_exists('location_updated_at', $data)) {
            $data['location_updated_at'] = Carbon::now();
        }

        if (array_key_exists('vehicle_type_id', $data)) {
            $vehicle->vehicle_type_id = $data['vehicle_type_id']
                ? VehicleType::where('uuid', $data['vehicle_type_id'])->value('id')
                : null;
        }

        if (array_key_exists('merchant_id', $data)) {
            $merchant = $this->resolveVehicleMerchant($user, $data['merchant_id']);
            $vehicle->merchant_id = $merchant?->id;
            if ($merchant?->account_id) {
                $vehicle->account_id = $merchant->account_id;
            }
        }

        foreach (['make', 'model', 'color', 'plate_number', 'vin_number', 'engine_number', 'ref_code', 'odometer', 'year', 'last_location_address', 'location_updated_at', 'intergration_id', 'photo_key', 'metadata'] as $field) {
            if (array_key_exists($field, $data)) {
                $vehicle->{$field} = $data[$field];
            }
        }

        if (array_key_exists('is_active', $data)) {
            $vehicle->is_active = (bool) $data['is_active'];
        }

        $vehicle->save();

        $after = $vehicle->only(array_keys($before));
        $changes = $this->activityLogService->diffChanges($before, $after);
        if (!empty($changes)) {
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'vehicle',
                entity: $vehicle,
                actor: $user,
                accountId: $vehicle->account_id,
                merchantId: $vehicle->merchant_id,
                title: 'Vehicle updated',
                changes: $changes
            );
        }

        return $vehicle->load(['merchant', 'vehicleType', 'lastDriver.user']);
    }

    public function deleteVehicle(User $user, string $vehicleUuid): void
    {
        $vehicle = $this->getVehicle($user, $vehicleUuid);
        $this->activityLogService->log(
            action: 'deleted',
            entityType: 'vehicle',
            entity: $vehicle,
            actor: $user,
            accountId: $vehicle->account_id,
            merchantId: $vehicle->merchant_id,
            title: 'Vehicle deleted',
            metadata: [
                'plate_number' => $vehicle->plate_number,
                'make' => $vehicle->make,
                'model' => $vehicle->model,
            ]
        );
        $vehicle->delete();
    }

    public function importVehicles(User $user, array $data): array
    {
        $merchant = $this->resolveImportMerchant($user, $data['merchant_id']);
        $rows = $this->readCsvRows($data['file']);

        $processed = 0;
        $created = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        foreach ($rows as $entry) {
            $processed++;
            $line = $entry['line'];
            $mapped = $this->mapVehicleImportRow($entry['row']);

            if ($mapped['errors'] !== []) {
                $failed++;
                $errors[] = [
                    'line' => $line,
                    'errors' => $mapped['errors'],
                ];
                continue;
            }

            try {
                $payload = [
                    'account_id' => $merchant->account_id,
                    'merchant_id' => $merchant->id,
                    'vehicle_type_id' => $this->resolveVehicleTypeIdOrFail($mapped['data']['vehicle_type_id'] ?? null),
                    'make' => $mapped['data']['make'],
                    'model' => $mapped['data']['model'],
                    'color' => $mapped['data']['color'],
                    'plate_number' => $mapped['data']['plate_number'],
                    'vin_number' => $mapped['data']['vin_number'],
                    'engine_number' => $mapped['data']['engine_number'],
                    'ref_code' => $mapped['data']['ref_code'],
                    'odometer' => $mapped['data']['odometer'],
                    'year' => $mapped['data']['year'],
                    'intergration_id' => $mapped['data']['intergration_id'],
                    'photo_key' => $mapped['data']['photo_key'],
                    'is_active' => $mapped['data']['is_active'],
                    'metadata' => $mapped['data']['metadata'],
                ];

                $vehicle = $this->resolveVehicleImportTarget($merchant->id, $merchant->account_id, $payload);
                $isUpdate = $vehicle !== null;

                if (!$vehicle) {
                    $vehicle = new Vehicle();
                }

                $vehicle->fill($payload);
                $vehicle->save();

                if ($vehicle->trashed()) {
                    $vehicle->restore();
                }

                if ($isUpdate) {
                    $updated++;
                } else {
                    $created++;
                }
            } catch (\Throwable $exception) {
                $failed++;
                $errors[] = [
                    'line' => $line,
                    'errors' => ['Unable to persist row: ' . $exception->getMessage()],
                ];
            }
        }

        return [
            'processed' => $processed,
            'created' => $created,
            'updated' => $updated,
            'failed' => $failed,
            'errors' => $errors,
        ];
    }

    private function shouldScopeToAccount(User $user): bool
    {
        return $user->role === 'user' && !empty($user->account_id);
    }

    private function buildScopedVehicleQuery(User $user, array $filters = [])
    {
        $query = Vehicle::query()->select('vehicles.*');

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if (!empty($merchantUuid)) {
            $merchantQuery = Merchant::query()->where('uuid', $merchantUuid);
            if ($this->shouldScopeToAccount($user)) {
                $merchantQuery->where('account_id', $user->account_id);
            }
            $merchant = $merchantQuery->first();
            if ($merchant) {
                $query->where('vehicles.merchant_id', $merchant->id);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($this->shouldScopeToAccount($user)) {
            $query->where('vehicles.account_id', $user->account_id);
        }

        return $query;
    }

    private function resolveMerchant(User $user): ?Merchant
    {
        $merchant = $user->merchants()->orderBy('merchants.id')->first();
        if (!$merchant) {
            $merchant = $user->ownedMerchants()->orderBy('id')->first();
        }

        return $merchant;
    }

    private function resolveVehicleMerchant(User $user, ?string $merchantUuid): ?Merchant
    {
        if (!$merchantUuid) {
            return $this->resolveMerchant($user);
        }

        return $this->resolveImportMerchant($user, $merchantUuid);
    }

    private function resolveImportMerchant(User $user, string $merchantUuid): Merchant
    {
        $query = Merchant::query()->where('uuid', $merchantUuid);
        if ($this->shouldScopeToAccount($user)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    private function readCsvRows(UploadedFile $file): array
    {
        $csv = new \SplFileObject($file->getRealPath());
        $csv->setFlags(\SplFileObject::READ_CSV | \SplFileObject::SKIP_EMPTY | \SplFileObject::DROP_NEW_LINE);

        $rawHeaders = $csv->fgetcsv();
        if (!is_array($rawHeaders) || $rawHeaders === [null]) {
            throw ValidationException::withMessages([
                'file' => 'The CSV file is empty or does not contain a header row.',
            ]);
        }

        $headers = [];
        foreach ($rawHeaders as $index => $header) {
            $value = trim((string) ($header ?? ''));
            if ($index === 0) {
                $value = preg_replace('/^\xEF\xBB\xBF/', '', $value) ?? $value;
            }
            $headers[] = strtolower($value);
        }

        $rows = [];
        $line = 1;
        foreach ($csv as $record) {
            $line++;
            if (!is_array($record) || $record === [null]) {
                continue;
            }

            if (count($record) === 1 && trim((string) ($record[0] ?? '')) === '') {
                continue;
            }

            $record = array_pad($record, count($headers), null);
            $record = array_slice($record, 0, count($headers));
            $rows[] = [
                'line' => $line,
                'row' => array_combine($headers, $record),
            ];
        }

        return $rows;
    }

    private function mapVehicleImportRow(array $row): array
    {
        $normalized = [];
        foreach ($row as $key => $value) {
            $normalized[strtolower(trim((string) $key))] = trim((string) ($value ?? ''));
        }

        $errors = [];
        $vehicleTypeUuid = $normalized['vehicle_type_id'] ?? '';
        if ($vehicleTypeUuid !== '' && !Str::isUuid($vehicleTypeUuid)) {
            $errors[] = 'vehicle_type_id must be a valid UUID.';
        }

        $odometer = $this->parseNullableInt($normalized['odometer'] ?? null);
        if (($normalized['odometer'] ?? '') !== '' && $odometer === null) {
            $errors[] = 'odometer must be an integer.';
        }

        $year = $this->parseNullableInt($normalized['year'] ?? null);
        if (($normalized['year'] ?? '') !== '' && $year === null) {
            $errors[] = 'year must be an integer.';
        } elseif ($year !== null && ($year < 1900 || $year > 2100)) {
            $errors[] = 'year must be between 1900 and 2100.';
        }

        $isActive = $this->parseNullableBool($normalized['is_active'] ?? null);
        if (($normalized['is_active'] ?? '') !== '' && $isActive === null) {
            $errors[] = 'is_active must be a boolean.';
        }

        $metadata = $this->parseNullableJsonArray($normalized['metadata_json'] ?? null);
        if (($normalized['metadata_json'] ?? '') !== '' && $metadata === null) {
            $errors[] = 'metadata_json must be a valid JSON object or array.';
        }

        if (($normalized['intergration_id'] ?? '') === ''
            && ($normalized['plate_number'] ?? '') === ''
            && ($normalized['ref_code'] ?? '') === '') {
            $errors[] = 'One of intergration_id, plate_number, or ref_code is required.';
        }

        return [
            'errors' => $errors,
            'data' => [
                'vehicle_type_id' => $vehicleTypeUuid !== '' ? $vehicleTypeUuid : null,
                'make' => $this->nullableString($normalized['make'] ?? null),
                'model' => $this->nullableString($normalized['model'] ?? null),
                'color' => $this->nullableString($normalized['color'] ?? null),
                'plate_number' => $this->nullableString($normalized['plate_number'] ?? null),
                'vin_number' => $this->nullableString($normalized['vin_number'] ?? null),
                'engine_number' => $this->nullableString($normalized['engine_number'] ?? null),
                'ref_code' => $this->nullableString($normalized['ref_code'] ?? null),
                'odometer' => $odometer,
                'year' => $year,
                'intergration_id' => $this->nullableString($normalized['intergration_id'] ?? null),
                'photo_key' => $this->nullableString($normalized['photo_key'] ?? null),
                'is_active' => $isActive ?? true,
                'metadata' => $metadata,
            ],
        ];
    }

    private function resolveVehicleTypeIdOrFail(?string $vehicleTypeUuid): ?int
    {
        if (!$vehicleTypeUuid) {
            return null;
        }

        $vehicleTypeId = VehicleType::query()->where('uuid', $vehicleTypeUuid)->value('id');
        if (!$vehicleTypeId) {
            throw ValidationException::withMessages([
                'vehicle_type_id' => 'vehicle_type_id does not exist.',
            ]);
        }

        return (int) $vehicleTypeId;
    }

    private function resolveVehicleImportTarget(int $merchantId, int $accountId, array $payload): ?Vehicle
    {
        if (!empty($payload['intergration_id'])) {
            return Vehicle::withTrashed()
                ->where('merchant_id', $merchantId)
                ->where('account_id', $accountId)
                ->where('intergration_id', $payload['intergration_id'])
                ->first();
        }

        if (!empty($payload['plate_number'])) {
            return Vehicle::withTrashed()
                ->where('merchant_id', $merchantId)
                ->where('account_id', $accountId)
                ->where('plate_number', $payload['plate_number'])
                ->first();
        }

        if (!empty($payload['ref_code'])) {
            return Vehicle::withTrashed()
                ->where('merchant_id', $merchantId)
                ->where('account_id', $accountId)
                ->where('ref_code', $payload['ref_code'])
                ->first();
        }

        return null;
    }

    private function parseNullableInt(null|string $value): ?int
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $value = trim($value);
        if (!preg_match('/^-?\d+$/', $value)) {
            return null;
        }

        return (int) $value;
    }

    private function parseNullableBool(null|string $value): ?bool
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);

        return is_bool($parsed) ? $parsed : null;
    }

    private function parseNullableJsonArray(null|string $value): array|null
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);
        if (!is_array($decoded)) {
            return null;
        }

        return $decoded;
    }

    private function nullableString(null|string $value): ?string
    {
        $value = trim((string) ($value ?? ''));

        return $value !== '' ? $value : null;
    }

}
