<?php

namespace App\Services;

use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\MerchantIntegration;
use App\Models\User;
use App\Models\VehicleType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DriverService
{
    public function __construct(private ActivityLogService $activityLogService)
    {
    }

    public function listDrivers(User $user, array $filters): LengthAwarePaginator
    {
        $query = Driver::query()
            ->select('drivers.*')
            ->join('users', 'users.id', '=', 'drivers.user_id')
            ->with(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType']);

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if (!empty($merchantUuid)) {
            $merchantId = Merchant::where('uuid', $merchantUuid)->value('id');
            if ($merchantId) {
                $this->applyMerchantScope($query, $merchantId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($this->isMerchant($user)) {
            if (empty($merchantUuid)) {
                $merchant = $this->resolveMerchant($user);
                if ($merchant) {
                    $this->applyMerchantScope($query, $merchant->id);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        }

        if (array_key_exists('is_active', $filters)) {
            $query->where('is_active', (bool) $filters['is_active']);
        }

        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(' ', '%', trim((string) $filters['search'])) . '%';
            $query->where(function (Builder $builder) use ($searchTerm) {
                $builder->where('users.name', 'like', $searchTerm)
                    ->orWhere('users.email', 'like', $searchTerm);
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);
        $this->applyDriverListSorting($query, $filters);

        $sql = $query->toSql();
        $bindings = $query->getBindings();

        Log::info('Driver list query', [
            'user_id' => $user->id,
            'filters' => $filters,
            'sql' => $sql,
            'bindings' => $bindings,
            'interpolated_sql' => Str::replaceArray('?', array_map(
                static function ($binding): string {
                    if ($binding === null) {
                        return 'null';
                    }

                    if (is_bool($binding)) {
                        return $binding ? '1' : '0';
                    }

                    if (is_numeric($binding)) {
                        return (string) $binding;
                    }

                    return "'" . str_replace("'", "''", (string) $binding) . "'";
                },
                $bindings
            ), $sql),
        ]);

        return $query->paginate($perPage);
    }

    private function applyDriverListSorting(Builder $query, array $filters): void
    {
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? 'desc'));

        if (!in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $sortableColumns = [
            'created_at' => 'drivers.created_at',
            'name' => 'users.name',
            'email' => 'users.email',
            'telephone' => 'users.telephone',
            'intergration_id' => 'drivers.intergration_id',
            'is_active' => 'drivers.is_active',
            'imported_at' => 'drivers.imported_at',
        ];

        $sortColumn = $sortableColumns[$sortBy] ?? 'drivers.created_at';

        $query->orderBy($sortColumn, $sortDirection)
            ->orderByDesc('drivers.id');
    }

    public function getDriver(User $user, string $driverUuid, ?string $merchantUuid = null): Driver
    {
        $query = Driver::with(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType'])->where('uuid', $driverUuid);
        if ($this->isMerchant($user)) {
            $merchant = $this->resolveMerchant($user, $merchantUuid);
            if (!$merchant) {
                $query->whereRaw('1 = 0');
            } else {
                $this->applyMerchantScope($query, $merchant->id);
            }
        }

        return $query->firstOrFail();
    }

    public function createDriver(User $user, array $data): Driver
    {
        return DB::transaction(function () use ($user, $data) {
            $accountId = $user->account_id;
            $merchant = $this->resolveMerchant($user);
            $merchantId = $merchant?->id;
            $carrierId = null;
            $vehicleTypeId = null;

            if ($this->isMerchant($user)) {
                $carrierId = $this->getOrCreateMerchantCarrierId($user);
                if (!$carrierId) {
                    throw new \RuntimeException('Merchant profile not found.');
                }
                $merchantId = $merchant?->id;
            } elseif (!empty($data['carrier_id'])) {
                $carrierId = Carrier::where('uuid', $data['carrier_id'])->value('id');
                if ($carrierId) {
                    $merchantId = Carrier::whereKey($carrierId)->value('merchant_id');
                }
            }

            if (!empty($data['vehicle_type_id'])) {
                $vehicleTypeId = VehicleType::where('uuid', $data['vehicle_type_id'])->value('id');
            }

            $userModel = User::create([
                'name' => $data['name'],
                'email' => $data['email'],
                'telephone' => $data['telephone'] ?? null,
                'password' => Hash::make($data['password']),
                'role' => 'driver',
                'account_id' => $accountId,
            ]);

            $driver = Driver::create([
                'account_id' => $accountId,
                'merchant_id' => $merchantId,
                'user_id' => $userModel->id,
                'carrier_id' => $carrierId,
                'vehicle_type_id' => $vehicleTypeId,
                'is_active' => $data['is_active'] ?? true,
                'notes' => $data['notes'] ?? null,
                'metadata' => $data['metadata'] ?? null,
            ]);

            $this->activityLogService->log(
                action: 'created',
                entityType: 'driver',
                entity: $driver,
                actor: $user,
                accountId: $driver->account_id,
                merchantId: $merchant?->id,
                title: 'Driver created',
                changes: $this->activityLogService->diffChanges([], [
                    'name' => $userModel->name,
                    'email' => $userModel->email,
                    'telephone' => $userModel->telephone,
                    'carrier_id' => $driver->carrier_id,
                    'is_active' => (bool) $driver->is_active,
                ])
            );

            return $driver->load(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType']);
        });
    }

    public function updateDriver(User $user, string $driverUuid, array $data): Driver
    {
        return DB::transaction(function () use ($user, $driverUuid, $data) {
            $query = Driver::with('user')->where('uuid', $driverUuid);
            if ($this->isMerchant($user)) {
                $merchant = $this->resolveMerchant($user);
                if (!$merchant) {
                    $query->whereRaw('1 = 0');
                } else {
                    $this->applyMerchantScope($query, $merchant->id);
                }
            }
            $driver = $query->firstOrFail();
            $before = [
                'carrier_id' => $driver->carrier_id,
                'vehicle_type_id' => $driver->vehicle_type_id,
                'is_active' => $driver->is_active,
                'notes' => $driver->notes,
                'metadata' => $driver->metadata,
                'name' => $driver->user?->name,
                'email' => $driver->user?->email,
                'telephone' => $driver->user?->telephone,
            ];

            if (!$this->isMerchant($user)) {
                if (!empty($data['carrier_id'])) {
                    $driver->carrier_id = Carrier::where('uuid', $data['carrier_id'])->value('id');
                    $driver->merchant_id = Carrier::whereKey($driver->carrier_id)->value('merchant_id');
                }
                if (array_key_exists('carrier_id', $data) && empty($data['carrier_id'])) {
                    $driver->carrier_id = null;
                }
            }

            if (!empty($data['vehicle_type_id'])) {
                $driver->vehicle_type_id = VehicleType::where('uuid', $data['vehicle_type_id'])->value('id');
            }
            if (array_key_exists('vehicle_type_id', $data) && empty($data['vehicle_type_id'])) {
                $driver->vehicle_type_id = null;
            }

            if (array_key_exists('is_active', $data)) {
                $driver->is_active = (bool) $data['is_active'];
            }

            if (array_key_exists('notes', $data)) {
                $driver->notes = $data['notes'];
            }
            if (array_key_exists('metadata', $data)) {
                $driver->metadata = $data['metadata'];
            }

            $driver->save();

            $userModel = $driver->user;
            if (array_key_exists('name', $data)) {
                $userModel->name = $data['name'];
            }
            if (array_key_exists('email', $data)) {
                $userModel->email = $data['email'];
            }
            if (array_key_exists('telephone', $data)) {
                $userModel->telephone = $data['telephone'];
            }
            if (!empty($data['password'])) {
                $userModel->password = Hash::make($data['password']);
            }
            $userModel->role = 'driver';
            $userModel->save();

            $after = [
                'carrier_id' => $driver->carrier_id,
                'vehicle_type_id' => $driver->vehicle_type_id,
                'is_active' => $driver->is_active,
                'notes' => $driver->notes,
                'metadata' => $driver->metadata,
                'name' => $userModel->name,
                'email' => $userModel->email,
                'telephone' => $userModel->telephone,
            ];
            $changes = $this->activityLogService->diffChanges($before, $after);
            if (!empty($changes)) {
                $merchant = $this->resolveMerchant($user);
                $this->activityLogService->log(
                    action: 'updated',
                    entityType: 'driver',
                    entity: $driver,
                    actor: $user,
                    accountId: $driver->account_id,
                    merchantId: $merchant?->id,
                    title: 'Driver updated',
                    changes: $changes
                );
            }

            return $driver->load(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType']);
        });
    }

    public function deleteDriver(User $user, string $driverUuid): void
    {
        $query = Driver::where('uuid', $driverUuid);
        if ($this->isMerchant($user)) {
            $merchant = $this->resolveMerchant($user);
            if (!$merchant) {
                $query->whereRaw('1 = 0');
            } else {
                $this->applyMerchantScope($query, $merchant->id);
            }
        }
        $driver = $query->firstOrFail();
        $merchant = $this->resolveMerchant($user);
        $this->activityLogService->log(
            action: 'deleted',
            entityType: 'driver',
            entity: $driver,
            actor: $user,
            accountId: $driver->account_id,
            merchantId: $merchant?->id,
            title: 'Driver deleted',
            metadata: [
                'name' => $driver->user?->name,
                'email' => $driver->user?->email,
            ]
        );
        $driver->delete();
    }

    public function updateDriverPassword(User $user, string $driverUuid, string $password): Driver
    {
        return DB::transaction(function () use ($user, $driverUuid, $password) {
            $query = Driver::with('user')->where('uuid', $driverUuid);
            if ($this->isMerchant($user)) {
                $merchant = $this->resolveMerchant($user);
                if (!$merchant) {
                    $query->whereRaw('1 = 0');
                } else {
                    $this->applyMerchantScope($query, $merchant->id);
                }
            }

            $driver = $query->firstOrFail();
            $userModel = $driver->user;
            $userModel->password = Hash::make($password);
            $userModel->save();

            $merchant = $this->resolveMerchant($user);
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'driver',
                entity: $driver,
                actor: $user,
                accountId: $driver->account_id,
                merchantId: $merchant?->id,
                title: 'Driver password updated',
                metadata: ['password_updated' => true]
            );

            return $driver->load(['user', 'merchant', 'carrier', 'vehicleType', 'vehicles.vehicleType']);
        });
    }

    public function importDrivers(User $user, array $data): array
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
            $mapped = $this->mapDriverImportRow($entry['row']);

            if ($mapped['errors'] !== []) {
                $failed++;
                $errors[] = [
                    'line' => $line,
                    'errors' => $mapped['errors'],
                ];
                continue;
            }

            try {
                DB::transaction(function () use ($user, $merchant, $mapped, &$created, &$updated): void {
                    $carrierId = $this->resolveDriverImportCarrierId($user, $merchant, $mapped['data']['carrier_id'] ?? null);
                    $vehicleTypeId = $this->resolveVehicleTypeIdOrFail($mapped['data']['vehicle_type_id'] ?? null);
                    [$driver, $userModel, $isUpdate] = $this->resolveDriverImportTarget($merchant, $mapped['data']);

                    if (!$userModel) {
                        $userModel = new User();
                        $userModel->account_id = $merchant->account_id;
                        $userModel->role = 'driver';
                    }

                    $userModel->name = $mapped['data']['name'];
                    $userModel->email = $mapped['data']['email'];
                    $userModel->telephone = $mapped['data']['telephone'];
                    if (!empty($mapped['data']['password'])) {
                        $userModel->password = Hash::make($mapped['data']['password']);
                    } elseif (!$userModel->exists) {
                        $userModel->password = Hash::make(Str::random(24));
                    }
                    $userModel->role = 'driver';
                    $userModel->save();

                    if (!$driver) {
                        $driver = new Driver();
                        $driver->account_id = $merchant->account_id;
                        $driver->merchant_id = $merchant->id;
                        $driver->user_id = $userModel->id;
                    }

                    $driver->user_id = $userModel->id;
                    $driver->merchant_id = $merchant->id;
                    $driver->carrier_id = $carrierId;
                    $driver->vehicle_type_id = $vehicleTypeId;
                    $driver->intergration_id = $mapped['data']['intergration_id'];
                    $driver->is_active = $mapped['data']['is_active'];
                    $driver->notes = $mapped['data']['notes'];
                    $driver->metadata = $mapped['data']['metadata'];
                    $driver->save();

                    if ($driver->trashed()) {
                        $driver->restore();
                    }

                    if ($isUpdate) {
                        $updated++;
                    } else {
                        $created++;
                    }
                });
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

    public function upsertProviderImportedDrivers(
        Merchant $merchant,
        MerchantIntegration $integration,
        string $providerSlug,
        array $payload
    ): array {
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
            return [
                'imported_count' => 0,
                'created_count' => 0,
                'updated_count' => 0,
                'drivers' => [],
            ];
        }

        $carrierId = $this->getOrCreateMerchantCarrierIdForMerchant($merchant);
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

        $importedDriverIds = [];
        $createdCount = 0;
        $updatedCount = 0;

        foreach ($itemsToImport as $entry) {
            $integrationId = $entry['integration_id'];
            $item = $entry['item'];
            $driver = $existingDriversByIntegrationId->get($integrationId);

            $email = $item['email'] ?? null;
            if (!$email) {
                $email = $this->buildImportedDriverEmailFast($providerSlug, $integrationId, $knownEmailOwners);
            }

            $isUpdate = (bool) $driver;

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
                'provider' => Str::slug($providerSlug),
                'imported_at' => now()->toIso8601String(),
                'provider_payload' => $item['provider_payload'] ?? null,
            ]);

            $driver->save();

            $importedDriverIds[] = (int) $driver->id;
            if ($isUpdate) {
                $updatedCount++;
            } else {
                $createdCount++;
            }
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

        return [
            'imported_count' => count($imported),
            'created_count' => $createdCount,
            'updated_count' => $updatedCount,
            'drivers' => $imported,
        ];
    }

    private function isMerchant(User $user): bool
    {
        return $user->role === 'user';
    }

    private function resolveMerchant(User $user, ?string $merchantUuid = null): ?Merchant
    {
        if (!empty($merchantUuid)) {
            $merchant = $user->merchants()
                ->where('merchants.uuid', $merchantUuid)
                ->orderBy('merchants.id')
                ->first();
            if ($merchant) {
                return $merchant;
            }

            $merchant = $user->ownedMerchants()
                ->where('uuid', $merchantUuid)
                ->orderBy('id')
                ->first();
            if ($merchant) {
                return $merchant;
            }
        }

        $merchant = $user->merchants()->orderBy('merchants.id')->first();
        if (!$merchant) {
            $merchant = $user->ownedMerchants()->orderBy('id')->first();
        }

        return $merchant;
    }

    private function applyMerchantScope(Builder $query, int $merchantId): Builder
    {
        return $query->where(function (Builder $builder) use ($merchantId) {
            $builder->where('merchant_id', $merchantId)
                ->orWhere(function (Builder $legacyBuilder) use ($merchantId) {
                    $legacyBuilder->whereNull('merchant_id')
                        ->whereHas('carrier', function (Builder $carrierBuilder) use ($merchantId) {
                            $carrierBuilder->where('merchant_id', $merchantId);
                        });
                });
        });
    }

    private function merchantCarrierId(User $user): ?int
    {
        $merchant = $this->resolveMerchant($user);
        if (!$merchant) {
            return null;
        }

        return Carrier::where('merchant_id', $merchant->id)->value('id');
    }

    private function getOrCreateMerchantCarrierId(User $user): ?int
    {
        $merchant = $this->resolveMerchant($user);
        if (!$merchant) {
            return null;
        }

        return $this->getOrCreateMerchantCarrierIdForMerchant($merchant);
    }

    private function getOrCreateMerchantCarrierIdForMerchant(Merchant $merchant): int
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

    private function mergeMetadata(?array $existing, array $updates): array
    {
        return array_merge($existing ?? [], array_filter(
            $updates,
            static fn ($value) => $value !== null
        ));
    }

    private function resolveImportMerchant(User $user, string $merchantUuid): Merchant
    {
        $query = Merchant::query()->where('uuid', $merchantUuid);
        if ($this->isMerchant($user) && !empty($user->account_id)) {
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

    private function mapDriverImportRow(array $row): array
    {
        $normalized = [];
        foreach ($row as $key => $value) {
            $normalized[strtolower(trim((string) $key))] = trim((string) ($value ?? ''));
        }

        $errors = [];

        if (($normalized['name'] ?? '') === '') {
            $errors[] = 'name is required.';
        }

        if (($normalized['email'] ?? '') === '' || !filter_var($normalized['email'], FILTER_VALIDATE_EMAIL)) {
            $errors[] = 'email must be a valid email address.';
        }

        $carrierUuid = $normalized['carrier_id'] ?? '';
        if ($carrierUuid !== '' && !Str::isUuid($carrierUuid)) {
            $errors[] = 'carrier_id must be a valid UUID.';
        }

        $vehicleTypeUuid = $normalized['vehicle_type_id'] ?? '';
        if ($vehicleTypeUuid !== '' && !Str::isUuid($vehicleTypeUuid)) {
            $errors[] = 'vehicle_type_id must be a valid UUID.';
        }

        $isActive = $this->parseNullableBool($normalized['is_active'] ?? null);
        if (($normalized['is_active'] ?? '') !== '' && $isActive === null) {
            $errors[] = 'is_active must be a boolean.';
        }

        $metadata = $this->parseNullableJsonArray($normalized['metadata_json'] ?? null);
        if (($normalized['metadata_json'] ?? '') !== '' && $metadata === null) {
            $errors[] = 'metadata_json must be a valid JSON object or array.';
        }

        return [
            'errors' => $errors,
            'data' => [
                'name' => $this->nullableString($normalized['name'] ?? null),
                'email' => $this->nullableString($normalized['email'] ?? null),
                'telephone' => $this->nullableString($normalized['telephone'] ?? null),
                'password' => $this->nullableString($normalized['password'] ?? null),
                'carrier_id' => $carrierUuid !== '' ? $carrierUuid : null,
                'vehicle_type_id' => $vehicleTypeUuid !== '' ? $vehicleTypeUuid : null,
                'intergration_id' => $this->nullableString($normalized['intergration_id'] ?? null),
                'is_active' => $isActive ?? true,
                'notes' => $this->nullableString($normalized['notes'] ?? null),
                'metadata' => $metadata,
            ],
        ];
    }

    private function resolveDriverImportCarrierId(User $user, Merchant $merchant, ?string $carrierUuid): ?int
    {
        if ($this->isMerchant($user)) {
            return $this->getOrCreateMerchantCarrierId($user);
        }

        if (!$carrierUuid) {
            return Carrier::query()->where('merchant_id', $merchant->id)->value('id');
        }

        $carrierId = Carrier::query()
            ->where('merchant_id', $merchant->id)
            ->where('uuid', $carrierUuid)
            ->value('id');
        if (!$carrierId) {
            throw ValidationException::withMessages([
                'carrier_id' => 'carrier_id does not exist for this merchant.',
            ]);
        }

        return (int) $carrierId;
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

    private function resolveDriverImportTarget(Merchant $merchant, array $data): array
    {
        $driver = null;
        $user = null;

        if (!empty($data['email'])) {
            $user = User::query()
                ->where('account_id', $merchant->account_id)
                ->where('email', $data['email'])
                ->first();

            if ($user) {
                $driver = Driver::withTrashed()
                    ->where(function (Builder $builder) use ($merchant) {
                        $builder->where('merchant_id', $merchant->id)
                            ->orWhere(function (Builder $legacyBuilder) use ($merchant) {
                                $legacyBuilder->whereNull('merchant_id')
                                    ->where('account_id', $merchant->account_id);
                            });
                    })
                    ->where('user_id', $user->id)
                    ->first();
            }
        }

        if (!$driver && !empty($data['intergration_id'])) {
            $driver = Driver::withTrashed()
                ->where(function (Builder $builder) use ($merchant) {
                    $builder->where('merchant_id', $merchant->id)
                        ->orWhere(function (Builder $legacyBuilder) use ($merchant) {
                            $legacyBuilder->whereNull('merchant_id')
                                ->where('account_id', $merchant->account_id);
                        });
                })
                ->where('intergration_id', $data['intergration_id'])
                ->first();

            if ($driver) {
                $user = $driver->user;
            }
        }

        return [$driver, $user, $driver !== null];
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
