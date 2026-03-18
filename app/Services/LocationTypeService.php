<?php

namespace App\Services;

use App\Models\Account;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LocationTypeService
{
    public function listByMerchant(User $user, string $merchantUuid, array $filters = []): array
    {
        $merchant = $this->resolveMerchant($user, $merchantUuid);

        $query = LocationType::query()
            ->with(['merchant:id,uuid', 'account:id,uuid'])
            ->where('merchant_id', $merchant->id)
            ->orderBy('sequence')
            ->orderBy('id');

        if (array_key_exists('collection_point', $filters)) {
            $query->where('collection_point', (bool) $filters['collection_point']);
        }

        if (array_key_exists('default', $filters)) {
            $query->where('default', (bool) $filters['default']);
        }

        $types = $query->get();
        if ($types->isEmpty()) {
            return [
                'types' => $this->defaultTypes($merchant->uuid, $merchant->account?->uuid),
                'is_default_fallback' => true,
            ];
        }

        return [
            'types' => $types,
            'is_default_fallback' => false,
        ];
    }

    public function syncByMerchant(User $user, string $merchantUuid, array $types): Collection
    {
        $merchant = $this->resolveMerchant($user, $merchantUuid);

        return DB::transaction(function () use ($merchant, $types) {
            $existing = LocationType::query()
                ->where('merchant_id', $merchant->id)
                ->get();

            $existingByUuid = $existing->keyBy('uuid');
            $existingBySlug = $existing->keyBy('slug');

            $savedIds = [];
            $requestedDefaultId = null;
            $resolvedSlugs = [];

            foreach ($types as $index => $payload) {
                $type = null;
                $requestedUuid = $payload['location_type_id'] ?? null;
                $resolvedSlug = $this->resolveSlug($payload, $index);

                if (in_array($resolvedSlug, $resolvedSlugs, true)) {
                    throw ValidationException::withMessages([
                        "types.$index.slug" => 'The resolved slug must be unique within the payload.',
                    ]);
                }

                $resolvedSlugs[] = $resolvedSlug;

                if ($requestedUuid) {
                    $type = $existingByUuid->get($requestedUuid);
                    if (!$type) {
                        throw ValidationException::withMessages([
                            "types.$index.location_type_id" => 'The selected location_type_id is invalid for this merchant.',
                        ]);
                    }
                }

                if (!$type) {
                    $type = $existingBySlug->get($resolvedSlug);
                }

                if (!$type) {
                    $type = new LocationType([
                        'account_id' => $merchant->account_id,
                        'merchant_id' => $merchant->id,
                    ]);
                }

                $type->slug = $resolvedSlug;
                $type->title = $payload['title'];
                $type->collection_point = (bool) ($payload['collection_point'] ?? false);
                $type->delivery_point = (bool) ($payload['delivery_point'] ?? false);
                $type->sequence = array_key_exists('sequence', $payload)
                    ? (int) $payload['sequence']
                    : ($index + 1);
                $type->icon = $payload['icon'] ?? null;
                $type->color = $payload['color'] ?? null;
                $type->default = false;
                $type->save();

                $savedIds[] = $type->id;
                $existingBySlug->put($type->slug, $type);
                $existingByUuid->put($type->uuid, $type);

                if ($requestedDefaultId === null && !empty($payload['default'])) {
                    $requestedDefaultId = $type->id;
                }
            }

            LocationType::query()
                ->where('merchant_id', $merchant->id)
                ->whereNotIn('id', $savedIds)
                ->forceDelete();

            return LocationType::query()
                ->with(['merchant:id,uuid', 'account:id,uuid'])
                ->where('merchant_id', $merchant->id)
                ->orderBy('sequence')
                ->orderBy('id')
                ->get();
        });
    }

    private function resolveSlug(array $payload, int $index): string
    {
        $slug = $payload['slug'] ?? null;
        if (is_string($slug) && trim($slug) !== '') {
            $resolved = Str::slug(trim($slug));
            if ($resolved !== '') {
                return $resolved;
            }

            throw ValidationException::withMessages([
                "types.$index.slug" => 'The provided slug is invalid.',
            ]);
        }

        $title = $payload['title'] ?? null;
        $resolved = is_string($title) ? Str::slug($title) : '';
        if ($resolved !== '') {
            return $resolved;
        }

        throw ValidationException::withMessages([
            "types.$index.slug" => 'Unable to generate slug from title. Please provide a slug.',
        ]);
    }

    private function resolveMerchant(User $user, string $merchantUuid): Merchant
    {
        $query = Merchant::query()
            ->with('account:id,uuid')
            ->where('uuid', $merchantUuid);

        if ($this->shouldScopeToAccount($user)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    private function shouldScopeToAccount(User $user): bool
    {
        return $user->role === 'user' && !empty($user->account_id);
    }

    private function defaultTypes(string $merchantUuid, ?string $accountUuid): Collection
    {
        $defaults = [
            ['slug' => 'depot', 'title' => 'Depot', 'collection_point' => true, 'delivery_point' => false, 'sequence' => 1, 'icon' => 'warehouse', 'color' => '#1D4ED8', 'default' => true],
            ['slug' => 'pickup', 'title' => 'Pickup', 'collection_point' => true, 'delivery_point' => false, 'sequence' => 2, 'icon' => 'map-pin', 'color' => '#16A34A', 'default' => false],
            ['slug' => 'dropoff', 'title' => 'Dropoff', 'collection_point' => false, 'delivery_point' => true, 'sequence' => 3, 'icon' => 'flag', 'color' => '#2563EB', 'default' => false],
            ['slug' => 'service', 'title' => 'Service', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 4, 'icon' => 'wrench', 'color' => '#F59E0B', 'default' => false],
            ['slug' => 'waypoint', 'title' => 'Waypoint', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 5, 'icon' => 'navigation', 'color' => '#0EA5E9', 'default' => false],
            ['slug' => 'break', 'title' => 'Break', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 6, 'icon' => 'coffee', 'color' => '#A855F7', 'default' => false],
            ['slug' => 'fuel', 'title' => 'Fuel', 'collection_point' => false, 'delivery_point' => false, 'sequence' => 7, 'icon' => 'fuel', 'color' => '#EF4444', 'default' => false],
        ];

        return collect($defaults)->map(function (array $payload) use ($merchantUuid, $accountUuid) {
            $type = new LocationType($payload);
            $type->setRelation('merchant', new Merchant(['uuid' => $merchantUuid]));

            if ($accountUuid) {
                $type->setRelation('account', new Account(['uuid' => $accountUuid]));
            }

            return $type;
        });
    }
}
