<?php

namespace App\Services;

use App\Models\Location;
use App\Models\Merchant;
use App\Models\Tag;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TagService
{
    public function listTags(User $user, array $filters): LengthAwarePaginator
    {
        $merchant = $this->resolveMerchant($user, (string) $filters['merchant_id']);
        $query = Tag::query()
            ->where('merchant_id', $merchant->id)
            ->orderBy('name')
            ->orderBy('id');

        if (!empty($filters['search'])) {
            $searchTerm = '%' . str_replace(' ', '%', trim((string) $filters['search'])) . '%';
            $query->where(function ($builder) use ($searchTerm) {
                $builder->where('name', 'like', $searchTerm)
                    ->orWhere('slug', 'like', $searchTerm);
            });
        }

        return $query->paginate(min((int) ($filters['per_page'] ?? 20), 100));
    }

    /**
     * @param Vehicle|Location $entity
     */
    public function syncTags(User $user, Model $entity, array $tagNames): Model
    {
        if (!in_array($entity::class, [Vehicle::class, Location::class], true)) {
            throw ValidationException::withMessages([
                'entity' => 'Tags can only be assigned to vehicles and locations.',
            ]);
        }

        $this->assertEntityAccess($user, $entity);
        if (empty($entity->merchant_id) || empty($entity->account_id)) {
            throw ValidationException::withMessages([
                'tags' => 'Tags can only be assigned to merchant-scoped entries.',
            ]);
        }

        $normalizedTags = $this->normalizeTagNames($tagNames);
        $tagIds = [];

        foreach ($normalizedTags as $tag) {
            $record = Tag::query()->firstOrCreate(
                [
                    'merchant_id' => $entity->merchant_id,
                    'slug' => $tag['slug'],
                ],
                [
                    'account_id' => $entity->account_id,
                    'name' => $tag['name'],
                ]
            );

            $tagIds[] = $record->id;
        }

        $entity->tags()->sync($tagIds);

        return $entity->load(['tags']);
    }

    public function namesFor(Model $entity): array
    {
        return $entity->tags
            ->pluck('name')
            ->sort(SORT_NATURAL | SORT_FLAG_CASE)
            ->values()
            ->all();
    }

    private function resolveMerchant(User $user, string $merchantUuid): Merchant
    {
        $query = Merchant::query()->where('uuid', $merchantUuid);
        if ($this->shouldScopeToAccount($user)) {
            $query->where('account_id', $user->account_id);
        }

        return $query->firstOrFail();
    }

    private function assertEntityAccess(User $user, Model $entity): void
    {
        if ($this->shouldScopeToAccount($user) && (int) $entity->account_id !== (int) $user->account_id) {
            abort(404);
        }
    }

    private function shouldScopeToAccount(User $user): bool
    {
        return $user->role === 'user' && !empty($user->account_id);
    }

    private function normalizeTagNames(array $tagNames): array
    {
        $tags = [];

        foreach ($tagNames as $name) {
            $name = trim((string) $name);
            if ($name === '') {
                continue;
            }

            $name = preg_replace('/\s+/', ' ', $name) ?? $name;
            $slug = Str::slug($name);
            if ($slug === '') {
                throw ValidationException::withMessages([
                    'tags' => 'Tag names must contain at least one letter or number.',
                ]);
            }

            $tags[$slug] = [
                'name' => $name,
                'slug' => $slug,
            ];
        }

        return array_values($tags);
    }
}
