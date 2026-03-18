<?php

namespace App\Services;

use App\Models\DeliveryRoute;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\RouteStop;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class RouteService
{
    public function __construct(private ActivityLogService $activityLogService)
    {
    }

    public function listRoutes(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->scopedQuery($user)
            ->with(['merchant', 'environment', 'routeStops.location']);

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()->where('uuid', $filters['merchant_id'])->value('id');
            $query->where('merchant_id', $merchantId ?? 0);
        }

        if (!empty($filters['code'])) {
            $query->where('code', 'like', '%' . $filters['code'] . '%');
        }

        if (!empty($filters['title'])) {
            $query->where('title', 'like', '%' . $filters['title'] . '%');
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            if ($search !== '') {
                $query->where(function (Builder $builder) use ($search) {
                    $builder
                        ->where('title', 'like', '%' . $search . '%')
                        ->orWhere('code', 'like', '%' . $search . '%')
                        ->orWhere('description', 'like', '%' . $search . '%');
                });
            }
        }

        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';
        $sortableColumns = [
            'created_at' => 'created_at',
            'updated_at' => 'updated_at',
            'title' => 'title',
            'code' => 'code',
            'estimated_distance' => 'estimated_distance',
            'estimated_duration' => 'estimated_duration',
        ];
        $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
        $query
            ->orderBy($sortColumn, $sortDirection)
            ->orderBy('id');

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->paginate($perPage);
    }

    public function createRoute(User $user, array $data): DeliveryRoute
    {
        return DB::transaction(function () use ($user, $data) {
            $merchant = $this->resolveMerchantForUser($user, $data['merchant_id']);
            $environment = $this->resolveEnvironment($merchant, $data['environment_id'] ?? null);

            $this->ensureCodeUnique($merchant->id, $data['code']);

            $route = DeliveryRoute::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $environment?->id,
                'title' => $data['title'],
                'code' => $data['code'],
                'description' => $data['description'] ?? null,
                'estimated_distance' => $data['estimated_distance'] ?? null,
                'estimated_duration' => $data['estimated_duration'] ?? null,
                'estimated_collection_time' => $data['estimated_collection_time'] ?? null,
                'estimated_delivery_time' => $data['estimated_delivery_time'] ?? null,
                'auto_created' => false,
            ]);

            $this->syncStops($route, $data['stops']);

            $this->activityLogService->log(
                action: 'created',
                entityType: 'route',
                entity: $route,
                actor: $user,
                accountId: $route->account_id,
                merchantId: $route->merchant_id,
                environmentId: $route->environment_id,
                title: 'Route created',
                metadata: ['stops_count' => count($data['stops'])]
            );

            return $this->loadRoute($route);
        });
    }

    public function getRouteForUser(User $user, string $routeUuid): DeliveryRoute
    {
        return $this->scopedQuery($user)
            ->with(['merchant', 'environment', 'routeStops.location'])
            ->where('uuid', $routeUuid)
            ->firstOrFail();
    }

    public function updateRoute(User $user, DeliveryRoute $route, array $data): DeliveryRoute
    {
        return DB::transaction(function () use ($user, $route, $data) {
            $before = $route->only([
                'title',
                'code',
                'description',
                'estimated_distance',
                'estimated_duration',
                'estimated_collection_time',
                'estimated_delivery_time',
            ]);

            if (array_key_exists('code', $data) && $data['code'] !== $route->code) {
                $this->ensureCodeUnique($route->merchant_id, $data['code'], $route->id);
                $route->code = $data['code'];
            }

            foreach ([
                'title',
                'description',
                'estimated_distance',
                'estimated_duration',
                'estimated_collection_time',
                'estimated_delivery_time',
            ] as $field) {
                if (array_key_exists($field, $data)) {
                    $route->{$field} = $data[$field];
                }
            }

            $route->save();

            if (array_key_exists('stops', $data)) {
                $this->syncStops($route, $data['stops']);
            }

            $changes = $this->activityLogService->diffChanges($before, $route->only(array_keys($before)));
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'route',
                entity: $route,
                actor: $user,
                accountId: $route->account_id,
                merchantId: $route->merchant_id,
                environmentId: $route->environment_id,
                title: 'Route updated',
                changes: $changes,
                metadata: array_key_exists('stops', $data)
                    ? ['stops_count' => count($data['stops'])]
                    : []
            );

            return $this->loadRoute($route);
        });
    }

    public function deleteRoute(User $user, DeliveryRoute $route): void
    {
        DB::transaction(function () use ($user, $route) {
            $route->routeStops()->delete();

            $this->activityLogService->log(
                action: 'deleted',
                entityType: 'route',
                entity: $route,
                actor: $user,
                accountId: $route->account_id,
                merchantId: $route->merchant_id,
                environmentId: $route->environment_id,
                title: 'Route deleted',
                metadata: ['code' => $route->code]
            );

            $route->delete();
        });
    }

    public function findOrCreateAutoRoute(
        Merchant $merchant,
        ?MerchantEnvironment $environment,
        Location $origin,
        Location $destination
    ): DeliveryRoute {
        $baseCode = $this->buildAutoCode($origin, $destination);
        $route = DeliveryRoute::withTrashed()
            ->where('merchant_id', $merchant->id)
            ->where('code', $baseCode)
            ->first();

        if ($route) {
            if ($route->trashed()) {
                $route->restore();
            }
        } else {
            $code = $this->nextAvailableCode($merchant->id, $baseCode);
            $route = DeliveryRoute::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $environment?->id,
                'title' => $this->buildAutoTitle($origin, $destination),
                'code' => $code,
                'description' => '',
                'auto_created' => true,
            ]);
        }

        $this->syncStops($route, [
            [
                'location_id' => $origin->uuid,
                'sequence' => 1,
            ],
            [
                'location_id' => $destination->uuid,
                'sequence' => 2,
            ],
        ]);

        return $this->loadRoute($route);
    }

    private function syncStops(DeliveryRoute $route, array $stops): void
    {
        $locations = Location::query()
            ->whereIn('uuid', array_column($stops, 'location_id'))
            ->where('merchant_id', $route->merchant_id)
            ->get()
            ->keyBy('uuid');

        $existingStopsBySequence = RouteStop::withTrashed()
            ->where('route_id', $route->id)
            ->orderBy('id')
            ->get()
            ->groupBy(fn (RouteStop $routeStop) => (int) $routeStop->sequence)
            ->map(fn ($group) => $group->values());

        $keptStopIds = [];

        foreach ($stops as $stop) {
            $location = $locations->get($stop['location_id']);
            if (!$location) {
                throw new UnprocessableEntityHttpException('One or more stops contain invalid locations for this merchant.');
            }

            $sequence = (int) $stop['sequence'];
            $group = $existingStopsBySequence->get($sequence);
            $routeStop = ($group && $group->isNotEmpty()) ? $group->shift() : null;

            if ($routeStop) {
                if ($routeStop->trashed()) {
                    $routeStop->restore();
                }

                if ((int) $routeStop->location_id !== (int) $location->id) {
                    $routeStop->location_id = $location->id;
                    $routeStop->save();
                }

                $keptStopIds[] = $routeStop->id;
                continue;
            }

            $createdStop = RouteStop::create([
                'route_id' => $route->id,
                'location_id' => $location->id,
                'sequence' => $sequence,
            ]);

            $keptStopIds[] = $createdStop->id;
        }

        RouteStop::query()
            ->where('route_id', $route->id)
            ->whereNotIn('id', $keptStopIds)
            ->delete();

        RouteStop::onlyTrashed()
            ->where('route_id', $route->id)
            ->whereIn('id', $keptStopIds)
            ->restore();
    }

    private function ensureCodeUnique(int $merchantId, string $code, ?int $ignoreId = null): void
    {
        $query = DeliveryRoute::withTrashed()
            ->where('merchant_id', $merchantId)
            ->where('code', $code);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw new UnprocessableEntityHttpException('The route code has already been taken for this merchant.');
        }
    }

    private function nextAvailableCode(int $merchantId, string $baseCode): string
    {
        $code = $baseCode;
        $suffix = 1;

        while (DeliveryRoute::withTrashed()->where('merchant_id', $merchantId)->where('code', $code)->exists()) {
            $suffix++;
            $code = $baseCode . '-' . $suffix;
        }

        return $code;
    }

    private function buildAutoCode(Location $origin, Location $destination): string
    {
        $originName = $this->locationNameForRouteCode($origin);
        $destinationName = $this->locationNameForRouteCode($destination);

        return substr(strtoupper('AUTO-ROUTE-' . $originName . '-' . $destinationName), 0, 120);
    }

    private function buildAutoTitle(Location $origin, Location $destination): string
    {
        return sprintf('Auto Route: %s to %s', $this->locationLabel($origin), $this->locationLabel($destination));
    }

    private function locationNameForRouteCode(Location $location): string
    {
        $source = $location->name ?: $location->company ?: $location->code ?: $location->uuid;

        return strtoupper(trim((string) preg_replace('/[^A-Za-z0-9]+/', '-', $source), '-'));
    }

    private function locationLabel(Location $location): string
    {
        return $location->name ?: $location->company ?: $location->code ?: $location->uuid;
    }

    private function resolveMerchantForUser(User $user, string $merchantUuid): Merchant
    {
        $query = Merchant::query()->where('uuid', $merchantUuid);
        if ($user->role !== 'super_admin' && !empty($user->account_id)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    private function resolveEnvironment(Merchant $merchant, ?string $environmentUuid): ?MerchantEnvironment
    {
        if (!$environmentUuid) {
            return null;
        }

        return MerchantEnvironment::query()
            ->where('uuid', $environmentUuid)
            ->where('merchant_id', $merchant->id)
            ->firstOrFail();
    }

    private function scopedQuery(User $user): Builder
    {
        $query = DeliveryRoute::query();

        if ($user->role === 'super_admin') {
            return $query;
        }

        if (!empty($user->account_id)) {
            return $query->where('account_id', $user->account_id);
        }

        $merchantIds = $user->merchants()->pluck('merchants.id')->all();
        $ownedMerchantIds = $user->ownedMerchants()->pluck('id')->all();
        $ids = array_values(array_unique(array_merge($merchantIds, $ownedMerchantIds)));

        if (empty($ids)) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn('merchant_id', $ids);
    }

    private function loadRoute(DeliveryRoute $route): DeliveryRoute
    {
        return $route->load(['merchant', 'environment', 'routeStops.location']);
    }
}
