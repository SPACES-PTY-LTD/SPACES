<?php

namespace App\Services;

use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LocationService
{
    public function __construct(
        private ActivityLogService $activityLogService,
        private TagService $tagService
    )
    {
    }

    public function listLocations(User $user, array $filters): LengthAwarePaginator
    {
        $supportsSpatialText = in_array(DB::connection()->getDriverName(), ['mysql', 'pgsql'], true);
        $sortableColumns = [
            'created_at' => 'locations.created_at',
            'name' => 'locations.name',
            'code' => 'locations.code',
            'company' => 'locations.company',
            'city' => 'locations.city',
            'type' => 'location_types.title',
        ];
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';

        $query = Location::query()
            ->select('locations.*')
            ->with(['locationType:id,uuid,slug,title', 'tags'])
            ->orderBy($sortColumn, $sortDirection)
            ->orderBy('locations.id');

        if ($sortBy === 'type') {
            $query->leftJoin('location_types', 'location_types.id', '=', 'locations.location_type_id');
        }

        if ($supportsSpatialText) {
            $query->selectRaw('ST_AsText(polygon_bounds) as polygon_bounds');
        }

        if ($this->shouldScopeToAccount($user)) {
            $query->where('locations.account_id', $user->account_id);
        }

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()
                ->when($this->shouldScopeToAccount($user), fn ($builder) => $builder->where('account_id', $user->account_id))
                ->where('uuid', $filters['merchant_id'])
                ->value('id');

            if ($merchantId) {
                $query->where('locations.merchant_id', $merchantId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (!empty($filters['location_type_id'])) {
            $locationTypeId = LocationType::query()
                ->when($this->shouldScopeToAccount($user), fn ($builder) => $builder->where('account_id', $user->account_id))
                ->when(
                    !empty($filters['merchant_id']),
                    fn ($builder) => $builder->whereHas('merchant', fn ($merchantQuery) => $merchantQuery->where('uuid', $filters['merchant_id']))
                )
                ->where('uuid', $filters['location_type_id'])
                ->value('id');

            if ($locationTypeId) {
                $query->where('locations.location_type_id', $locationTypeId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if (!empty($filters['tag_id'])) {
            $query->whereHas('tags', function ($tagQuery) use ($filters) {
                $tagQuery->where('tags.uuid', $filters['tag_id']);
            });
        }

        if (array_key_exists('environment_id', $filters)) {
            if ($filters['environment_id']) {
                $environmentId = MerchantEnvironment::query()
                    ->where('uuid', $filters['environment_id'])
                    ->value('id');

                if ($environmentId) {
                    $query->where('locations.environment_id', $environmentId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            } else {
                $query->whereNull('locations.environment_id');
            }
        }

        if (!empty($filters['code'])) {
            $query->where('locations.code', $filters['code']);
        }

        if (!empty($filters['city'])) {
            $query->where('locations.city', $filters['city']);
        }

        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(' ', '%', trim((string) $filters['search'])) . '%';
            $query->where(function ($builder) use ($searchTerm) {
                $builder->where('locations.name', 'like', $searchTerm)
                    ->orWhere('locations.code', 'like', $searchTerm)
                    ->orWhere('locations.company', 'like', $searchTerm)
                    ->orWhere('locations.full_address', 'like', $searchTerm)
                    ->orWhere('locations.address_line_1', 'like', $searchTerm)
                    ->orWhere('locations.address_line_2', 'like', $searchTerm)
                    ->orWhere('locations.town', 'like', $searchTerm)
                    ->orWhere('locations.city', 'like', $searchTerm)
                    ->orWhere('locations.country', 'like', $searchTerm)
                    ->orWhere('locations.first_name', 'like', $searchTerm)
                    ->orWhere('locations.last_name', 'like', $searchTerm)
                    ->orWhere('locations.phone', 'like', $searchTerm)
                    ->orWhere('locations.email', 'like', $searchTerm)
                    ->orWhere('locations.province', 'like', $searchTerm)
                    ->orWhere('locations.post_code', 'like', $searchTerm)
                    ->orWhere('locations.intergration_id', 'like', $searchTerm);
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->paginate($perPage);
    }

    public function getLocation(User $user, string $locationUuid): Location
    {
        $supportsSpatialText = in_array(DB::connection()->getDriverName(), ['mysql', 'pgsql'], true);

        $query = Location::query()
            ->select('locations.*')
            ->with(['locationType:id,uuid,slug,title', 'tags'])
            ->where('uuid', $locationUuid);

        if ($supportsSpatialText) {
            $query->selectRaw('ST_AsText(polygon_bounds) as polygon_bounds');
        }

        if ($this->shouldScopeToAccount($user)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    public function createLocation(User $user, array $data): Location
    {
        $merchant = Merchant::query()
            ->when($this->shouldScopeToAccount($user), fn ($builder) => $builder->where('account_id', $user->account_id))
            ->where('uuid', $data['merchant_id'])
            ->firstOrFail();

        $environmentId = null;
        if (array_key_exists('environment_id', $data) && $data['environment_id']) {
            $environmentId = MerchantEnvironment::query()
                ->where('uuid', $data['environment_id'])
                ->where('merchant_id', $merchant->id)
                ->firstOrFail()
                ->id;
        }

        $payload = [
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'environment_id' => $environmentId,
            'name' => $data['name'] ?? null,
            'code' => $data['code'] ?? null,
            'company' => $data['company'] ?? null,
            'full_address' => $data['full_address'] ?? null,
            'address_line_1' => $data['address_line_1'],
            'address_line_2' => $data['address_line_2'] ?? null,
            'town' => $data['town'] ?? null,
            'city' => $data['city'],
            'country' => $data['country'] ?? null,
            'first_name' => $data['first_name'] ?? null,
            'last_name' => $data['last_name'] ?? null,
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'province' => $data['province'],
            'post_code' => $data['post_code'],
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'google_place_id' => $data['google_place_id'] ?? null,
            'location_type_id' => !empty($data['location_type_id'])
                ? $this->resolveLocationTypeId($merchant, (string) $data['location_type_id'])
                : $this->firstOrCreateLocationTypeBySlug($merchant, 'waypoint')->id,
            'metadata' => $data['metadata'] ?? null,
        ];

        if (array_key_exists('polygon_bounds', $data)) {
            if ($data['polygon_bounds'] === null) {
                $payload['polygon_bounds'] = null;
            } else {
                $payload['polygon_bounds'] = $this->polygonToDatabaseValue($data['polygon_bounds']);
            }
        }

        $location = Location::create($payload);
        $this->activityLogService->log(
            action: 'created',
            entityType: 'location',
            entity: $location,
            actor: $user,
            accountId: $location->account_id,
            merchantId: $location->merchant_id,
            environmentId: $location->environment_id,
            title: 'Location created',
            changes: $this->activityLogService->diffChanges([], [
                'name' => $location->name,
                'code' => $location->code,
                'address_line_1' => $location->address_line_1,
                'city' => $location->city,
                'province' => $location->province,
                'post_code' => $location->post_code,
            ])
        );

        return $location->load(['locationType:id,uuid,slug,title', 'tags']);
    }

    public function updateLocation(User $user, string $locationUuid, array $data): Location
    {
        $location = $this->getLocation($user, $locationUuid);
        $before = $location->only([
            'environment_id',
            'name',
            'code',
            'company',
            'full_address',
            'address_line_1',
            'address_line_2',
            'town',
            'city',
            'country',
            'first_name',
            'last_name',
            'phone',
            'email',
            'province',
            'post_code',
            'latitude',
            'longitude',
            'google_place_id',
            'location_type_id',
            'metadata',
        ]);

        if (array_key_exists('environment_id', $data)) {
            if ($data['environment_id']) {
                $location->environment_id = MerchantEnvironment::query()
                    ->where('uuid', $data['environment_id'])
                    ->where('merchant_id', $location->merchant_id)
                    ->firstOrFail()
                    ->id;
            } else {
                $location->environment_id = null;
            }
        }

        if (array_key_exists('location_type_id', $data)) {
            $merchant = Merchant::query()->findOrFail($location->merchant_id);
            $location->location_type_id = $this->resolveLocationTypeId($merchant, (string) $data['location_type_id']);
        }

        foreach ([
            'name',
            'code',
            'company',
            'full_address',
            'address_line_1',
            'address_line_2',
            'town',
            'city',
            'country',
            'first_name',
            'last_name',
            'phone',
            'email',
            'province',
            'post_code',
            'latitude',
            'longitude',
            'google_place_id',
            'metadata',
        ] as $field) {
            if (array_key_exists($field, $data)) {
                $location->{$field} = $data[$field];
            }
        }

        if (array_key_exists('polygon_bounds', $data)) {
            if ($data['polygon_bounds'] === null) {
                $location->polygon_bounds = null;
            } else {
                $location->polygon_bounds = $this->polygonToDatabaseValue($data['polygon_bounds']);
            }
        }

        $location->save();
        $changes = $this->activityLogService->diffChanges($before, $location->only(array_keys($before)));
        if (!empty($changes)) {
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'location',
                entity: $location,
                actor: $user,
                accountId: $location->account_id,
                merchantId: $location->merchant_id,
                environmentId: $location->environment_id,
                title: 'Location updated',
                changes: $changes
            );
        }

        return $location->load(['locationType:id,uuid,slug,title', 'tags']);
    }

    public function syncTags(User $user, string $locationUuid, array $tagNames): Location
    {
        $location = $this->getLocation($user, $locationUuid);
        $before = ['tags' => $this->tagService->namesFor($location)];

        /** @var Location $location */
        $location = $this->tagService->syncTags($user, $location, $tagNames);
        $after = ['tags' => $this->tagService->namesFor($location)];
        $changes = $this->activityLogService->diffChanges($before, $after);

        if (!empty($changes)) {
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'location',
                entity: $location,
                actor: $user,
                accountId: $location->account_id,
                merchantId: $location->merchant_id,
                environmentId: $location->environment_id,
                title: 'Location tags updated',
                changes: $changes
            );
        }

        return $location->load(['locationType:id,uuid,slug,title', 'tags']);
    }

    public function deleteLocation(User $user, string $locationUuid): void
    {
        $location = $this->getLocation($user, $locationUuid);
        $this->activityLogService->log(
            action: 'deleted',
            entityType: 'location',
            entity: $location,
            actor: $user,
            accountId: $location->account_id,
            merchantId: $location->merchant_id,
            environmentId: $location->environment_id,
            title: 'Location deleted',
            metadata: [
                'name' => $location->name,
                'code' => $location->code,
                'full_address' => $location->full_address,
            ]
        );
        $location->delete();
    }

    public function importLocations(User $user, array $data): array
    {
        $merchant = Merchant::query()
            ->when($this->shouldScopeToAccount($user), fn ($builder) => $builder->where('account_id', $user->account_id))
            ->where('uuid', $data['merchant_id'])
            ->firstOrFail();

        $environment = null;
        if (!empty($data['environment_id'])) {
            $environment = MerchantEnvironment::query()
                ->where('uuid', $data['environment_id'])
                ->where('merchant_id', $merchant->id)
                ->firstOrFail();
        }

        $rows = $this->readCsvRows($data['file']);

        $processed = 0;
        $created = 0;
        $updated = 0;
        $failed = 0;
        $errors = [];

        foreach ($rows as $entry) {
            $processed++;
            $line = $entry['line'];
            $mapped = $this->mapImportRow($entry['row']);

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
                    'environment_id' => $environment?->id,
                    'company' => $mapped['data']['company'] ?? null,
                    'code' => $mapped['data']['code'],
                    'first_name' => $mapped['data']['first_name'] ?? null,
                    'last_name' => $mapped['data']['last_name'] ?? null,
                    'phone' => $mapped['data']['phone'] ?? null,
                    'email' => $mapped['data']['email'] ?? null,
                    'town' => $mapped['data']['town'] ?? null,
                    'name' => $mapped['data']['name'] ?? $mapped['data']['company'] ?? null,
                    'address_line_1' => $mapped['data']['address_line_1'],
                    'address_line_2' => $mapped['data']['address_line_2'] ?? null,
                    'city' => $mapped['data']['city'],
                    'province' => $mapped['data']['province'],
                    'post_code' => $mapped['data']['post_code'],
                    'country' => $mapped['data']['country'] ?? null,
                    'latitude' => $mapped['data']['latitude'] ?? null,
                    'longitude' => $mapped['data']['longitude'] ?? null,
                    'location_type_id' => $this->resolveImportedLocationTypeId(
                        $merchant,
                        $mapped['data']['location_type_id'] ?? null
                    ),
                ];

                $query = Location::withTrashed()
                    ->where('account_id', $merchant->account_id)
                    ->where('merchant_id', $merchant->id)
                    ->where('code', $payload['code']);

                if ($environment) {
                    $query->where('environment_id', $environment->id);
                } else {
                    $query->whereNull('environment_id');
                }

                $location = $query->first();
                $isUpdate = $location !== null;

                if (!$location) {
                    $location = new Location();
                }

                $location->fill($payload);

                if (array_key_exists('polygon_bounds', $mapped['data'])) {
                    if ($mapped['data']['polygon_bounds'] === null) {
                        $location->polygon_bounds = null;
                    } else {
                        $location->polygon_bounds = $this->polygonToDatabaseValue($mapped['data']['polygon_bounds']);
                    }
                }

                $location->save();

                if ($location->trashed()) {
                    $location->restore();
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
                    'errors' => ['Unable to persist row: '.$exception->getMessage()],
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

    public function storeFromAddress(
        array $address,
        Merchant $merchant,
        ?MerchantEnvironment $environment = null,
        string $defaultLocationTypeSlug = 'waypoint'
    ): Location
    {
        $payload = [
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'environment_id' => $environment?->id,
            'name' => $address['name'] ?? null,
            'code' => $address['code'] ?? null,
            'company' => $address['company'] ?? null,
            'full_address' => $address['full_address'] ?? null,
            'address_line_1' => $address['address_line_1'] ?? null,
            'address_line_2' => $address['address_line_2'] ?? null,
            'town' => $address['town'] ?? null,
            'city' => $address['city'] ?? null,
            'country' => $address['country'] ?? null,
            'first_name' => $address['first_name'] ?? null,
            'last_name' => $address['last_name'] ?? null,
            'phone' => $address['phone'] ?? null,
            'email' => $address['email'] ?? null,
            'province' => $address['province'] ?? null,
            'post_code' => $address['post_code'] ?? null,
            'latitude' => $address['latitude'] ?? null,
            'longitude' => $address['longitude'] ?? null,
            'google_place_id' => $address['google_place_id'] ?? null,
            'location_type_id' => $this->resolveAddressLocationTypeId($address, $merchant, $defaultLocationTypeSlug),
            'metadata' => $address['metadata'] ?? null,
        ];

        if (!empty($address['code'])) {
            return Location::updateOrCreate([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $environment?->id,
                'code' => $address['code'],
            ], $payload);
        }

        return Location::create($payload);
    }

    private function shouldScopeToAccount(User $user): bool
    {
        return $user->role === 'user' && !empty($user->account_id);
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

    private function mapImportRow(array $row): array
    {
        $normalized = [];
        foreach ($row as $key => $value) {
            $normalized[strtolower(trim((string) $key))] = trim((string) ($value ?? ''));
        }

        $errors = [];

        $latitude = $this->parseNullableFloat($normalized['latitude'] ?? null);
        if (($normalized['latitude'] ?? '') !== '' && $latitude === null) {
            $errors[] = 'latitude must be numeric.';
        }

        $longitude = $this->parseNullableFloat($normalized['longitude'] ?? null);
        if (($normalized['longitude'] ?? '') !== '' && $longitude === null) {
            $errors[] = 'longitude must be numeric.';
        }

        if (($normalized['code'] ?? '') === '') {
            // $errors[] = 'code is required.';
        }
        if (($normalized['address_line_1'] ?? '') === '') {
            // $errors[] = 'address_line_1 is required.';
        }
        if (($normalized['city'] ?? '') === '') {
            // $errors[] = 'city is required.';
        }
        if (($normalized['province'] ?? '') === '') {
            // $errors[] = 'province is required.';
        }

        $postCode = $normalized['post_code'] ?? $normalized['postcode'] ?? '';
        if ($postCode === '') {
            // $errors[] = 'postcode (or post_code) is required.';
        }

        $locationTypeUuid = trim((string) ($normalized['location_type_id'] ?? ''));
        if ($locationTypeUuid !== '' && !Str::isUuid($locationTypeUuid)) {
            $errors[] = 'location_type_id must be a valid UUID.';
        }

        $polygonResult = $this->extractPolygonBounds(
            $normalized['polygon_coordinates_json'] ?? '',
            $normalized['polygon_wkt'] ?? ''
        );
        if ($polygonResult['error']) {
            $errors[] = $polygonResult['error'];
        }

        return [
            'errors' => $errors,
            'data' => [
                'company' => $normalized['company'] ?? null,
                'code' => $normalized['code'] ?? null,
                'first_name' => $normalized['first_name'] ?? null,
                'last_name' => $normalized['last_name'] ?? null,
                'phone' => $normalized['phone'] ?? null,
                'email' => $normalized['email'] ?? null,
                'town' => $normalized['town'] ?? null,
                'name' => $normalized['name'] ?? null,
                'address_line_1' => $normalized['address_line_1'] ?? null,
                'address_line_2' => $normalized['address_line_2'] ?? null,
                'city' => $normalized['city'] ?? null,
                'province' => $normalized['province'] ?? null,
                'post_code' => $postCode,
                'country' => $normalized['country'] ?? null,
                'latitude' => $latitude,
                'longitude' => $longitude,
                'polygon_bounds' => $polygonResult['points'],
                'location_type_id' => $locationTypeUuid !== '' ? $locationTypeUuid : null,
            ],
        ];
    }

    private function resolveLocationTypeId(Merchant $merchant, string $locationTypeUuid): int
    {
        $locationTypeId = LocationType::query()
            ->where('merchant_id', $merchant->id)
            ->where('uuid', $locationTypeUuid)
            ->value('id');

        if (!$locationTypeId) {
            throw ValidationException::withMessages([
                'location_type_id' => 'The selected location_type_id is invalid for this merchant.',
            ]);
        }

        return (int) $locationTypeId;
    }

    private function resolveAddressLocationTypeId(array $address, Merchant $merchant, string $defaultSlug): int
    {
        $locationTypeUuid = $address['location_type_id'] ?? $address['location_type_uuid'] ?? null;
        if (is_string($locationTypeUuid) && trim($locationTypeUuid) !== '') {
            return $this->resolveLocationTypeId($merchant, trim($locationTypeUuid));
        }

        $locationTypeSlug = $address['location_type'] ?? $address['location_type_slug'] ?? null;
        if (is_string($locationTypeSlug) && trim($locationTypeSlug) !== '') {
            return $this->firstOrCreateLocationTypeBySlug($merchant, trim($locationTypeSlug))->id;
        }

        return $this->firstOrCreateLocationTypeBySlug($merchant, $defaultSlug)->id;
    }

    private function resolveImportedLocationTypeId(Merchant $merchant, ?string $locationTypeUuid): int
    {
        if (is_string($locationTypeUuid) && trim($locationTypeUuid) !== '') {
            return $this->resolveLocationTypeId($merchant, trim($locationTypeUuid));
        }

        return $this->firstOrCreateLocationTypeBySlug($merchant, 'waypoint')->id;
    }

    private function firstOrCreateLocationTypeBySlug(Merchant $merchant, string $slug): LocationType
    {
        $normalized = Str::slug($slug);
        if ($normalized === '') {
            $normalized = 'waypoint';
        }

        $type = LocationType::query()
            ->where('merchant_id', $merchant->id)
            ->where('slug', $normalized)
            ->first();

        if ($type) {
            return $type;
        }

        $defaults = [
            'depot' => ['title' => 'Depot', 'collection_point' => true, 'delivery_point' => false, 'sequence' => 1],
            'pickup' => ['title' => 'Pickup', 'collection_point' => true, 'delivery_point' => false, 'sequence' => 2],
            'dropoff' => ['title' => 'Dropoff', 'collection_point' => false, 'delivery_point' => true, 'sequence' => 3],
            'service' => ['title' => 'Service', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 4],
            'waypoint' => ['title' => 'Waypoint', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 5],
            'break' => ['title' => 'Break', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 6],
            'fuel' => ['title' => 'Fuel', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 7],
        ];

        $payload = $defaults[$normalized] ?? [
            'title' => Str::title(str_replace('-', ' ', $normalized)),
            'collection_point' => false,
            'delivery_point' => false,
            'sequence' => ((int) LocationType::query()->where('merchant_id', $merchant->id)->max('sequence')) + 1,
        ];

        return LocationType::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'slug' => $normalized,
            'title' => $payload['title'],
            'collection_point' => $payload['collection_point'],
            'delivery_point' => $payload['delivery_point'],
            'sequence' => $payload['sequence'],
            'default' => false,
        ]);
    }

    private function extractPolygonBounds(string $polygonJson, string $polygonWkt): array
    {
        if ($polygonJson !== '' && $polygonJson !== '[]') {
            $decoded = json_decode($polygonJson, true);
            if (!is_array($decoded)) {
                return ['points' => null, 'error' => 'polygon_coordinates_json must be valid JSON.'];
            }

            $points = [];
            foreach ($decoded as $idx => $pair) {
                if (!is_array($pair) || count($pair) !== 2 || !is_numeric($pair[0]) || !is_numeric($pair[1])) {
                    return ['points' => null, 'error' => "polygon_coordinates_json point {$idx} must be [latitude, longitude]."];
                }
                $points[] = [(float) $pair[0], (float) $pair[1]];
            }

            if (count($points) < 3) {
                return ['points' => null, 'error' => 'polygon_coordinates_json must contain at least 3 points.'];
            }

            return ['points' => $points, 'error' => null];
        }

        if ($polygonWkt !== '') {
            if (!preg_match('/^POLYGON\\s*\\(\\((.+)\\)\\)$/i', $polygonWkt, $matches)) {
                return ['points' => null, 'error' => 'polygon_wkt must be a valid POLYGON WKT string.'];
            }

            $pairs = array_filter(array_map('trim', explode(',', $matches[1])));
            $points = [];
            foreach ($pairs as $idx => $pair) {
                $segments = preg_split('/\\s+/', $pair);
                if (count($segments) !== 2 || !is_numeric($segments[0]) || !is_numeric($segments[1])) {
                    return ['points' => null, 'error' => "polygon_wkt point {$idx} is invalid."];
                }

                // WKT coordinates are longitude latitude; convert to [latitude, longitude].
                $points[] = [(float) $segments[1], (float) $segments[0]];
            }

            if (count($points) < 3) {
                return ['points' => null, 'error' => 'polygon_wkt must contain at least 3 points.'];
            }

            return ['points' => $points, 'error' => null];
        }

        return ['points' => null, 'error' => null];
    }

    private function parseNullableFloat(?string $value): ?float
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        return is_numeric($value) ? (float) $value : null;
    }

    private function polygonToSql(array $points): string
    {
        if (count($points) < 3) {
            throw ValidationException::withMessages([
                'polygon_bounds' => 'Polygon must contain at least 3 points.',
            ]);
        }

        $normalized = [];
        foreach ($points as $idx => $pair) {
            if (!is_array($pair) || count($pair) !== 2) {
                throw ValidationException::withMessages([
                    "polygon_bounds.$idx" => 'Each polygon point must be a [latitude, longitude] pair.',
                ]);
            }
            [$lat, $lng] = $pair;
            if (!is_numeric($lat) || !is_numeric($lng)) {
                throw ValidationException::withMessages([
                    "polygon_bounds.$idx" => 'Latitude and longitude must be numeric.',
                ]);
            }
            $normalized[] = [(float) $lat, (float) $lng];
        }

        $first = $normalized[0];
        $last = $normalized[count($normalized) - 1];
        if ($first[0] !== $last[0] || $first[1] !== $last[1]) {
            $normalized[] = $first;
        }

        $pairs = array_map(fn ($pair) => $pair[0].' '.$pair[1], $normalized);
        $wkt = 'POLYGON((' . implode(', ', $pairs) . '))';
        $safeWkt = str_replace("'", "''", $wkt);

        return "ST_GeomFromText('{$safeWkt}')";
    }

    private function polygonToDatabaseValue(array $points)
    {
        if (DB::connection()->getDriverName() === 'sqlite') {
            $rawSql = $this->polygonToSql($points);

            return preg_replace(
                ["/^ST_GeomFromText\\('/", "/'\\)$/"],
                ['', ''],
                $rawSql
            );
        }

        return DB::raw($this->polygonToSql($points));
    }
}
