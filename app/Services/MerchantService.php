<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\LocationType;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Arr;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class MerchantService
{
    public function createMerchant(User $user, array $data): Merchant
    {
        return DB::transaction(function () use ($user, $data) {
            $merchant = Merchant::create([
                'account_id' => $user->account_id,
                'owner_user_id' => $user->id,
                'name' => $data['name'],
                'legal_name' => $data['legal_name'] ?? null,
                'billing_email' => $data['billing_email'] ?? null,
                'support_email' => $data['support_email'] ?? null,
                'max_driver_distance' => $data['max_driver_distance'] ?? null,
                'delivery_offers_expiry_time' => $data['delivery_offers_expiry_time'] ?? 1,
                'driver_offline_timeout_minutes' => $data['driver_offline_timeout_minutes'] ?? 120,
                'default_webhook_url' => $data['default_webhook_url'] ?? null,
                'timezone' => $data['timezone'] ?? 'UTC',
                'operating_countries' => $data['operating_countries'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'status' => $data['status'] ?? 'active',
            ]);

            $merchant->users()->syncWithoutDetaching([
                $user->id => ['role' => MerchantAccess::ROLE_ACCOUNT_HOLDER],
            ]);

            if ($user->role === 'user') {
                $user->forceFill([
                    'last_accessed_merchant_id' => $merchant->id,
                ])->save();
            }

            return $merchant;
        });
    }

    public function listMerchants(User $user, array $filters): LengthAwarePaginator
    {
        $query = Merchant::query();

        if ($user->role !== 'super_admin') {
            if (MerchantAccess::canCreateMerchants($user) && !empty($user->account_id)) {
                $query->where('account_id', $user->account_id);
            } else {
                $query->where(function (Builder $builder) use ($user) {
                    $builder
                        ->whereHas('users', function (Builder $membershipBuilder) use ($user) {
                            $membershipBuilder->where('users.id', $user->id);
                        })
                        ->orWhere('owner_user_id', $user->id);
                });
            }
        } elseif (!empty($filters['with_trashed'])) {
            $query->withTrashed();
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['q'])) {
            $q = $filters['q'];
            $query->where(function (Builder $builder) use ($q) {
                $builder->where('name', 'like', "%{$q}%")
                    ->orWhere('legal_name', 'like', "%{$q}%");
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function updateMerchant(Merchant $merchant, array $data): Merchant
    {
        $merchant->fill(Arr::only($data, [
            'name',
            'legal_name',
            'billing_email',
            'support_email',
            'max_driver_distance',
            'delivery_offers_expiry_time',
            'driver_offline_timeout_minutes',
            'default_webhook_url',
            'metadata',
            'status',
        ]));
        $merchant->save();

        return $merchant;
    }

    public function deleteMerchant(Merchant $merchant): void
    {
        $merchant->delete();
    }

    public function updateMerchantSettings(Merchant $merchant, array $data): Merchant
    {
        $merchant->fill(Arr::only($data, [
            'timezone',
            'operating_countries',
            'allow_auto_shipment_creations_at_locations',
            'support_email',
            'max_driver_distance',
            'delivery_offers_expiry_time',
            'driver_offline_timeout_minutes',
            'setup_completed_at',
        ]));
        $merchant->save();

        return $merchant;
    }

    public function updateMerchantLogo(Merchant $merchant, UploadedFile $logo): Merchant
    {
        $disk = Storage::disk('s3');
        $extension = $logo->getClientOriginalExtension();
        $filename = (string) Str::uuid().($extension ? '.'.$extension : '');
        $path = sprintf('merchant-logos/%s/%s', $merchant->uuid, $filename);

        $disk->putFileAs(dirname($path), $logo, basename($path), ['visibility' => 'public']);

        if (!empty($merchant->logo_path) && $merchant->logo_path !== $path) {
            $disk->delete($merchant->logo_path);
        }

        $merchant->logo_path = $path;
        $merchant->save();

        return $merchant;
    }

    public function getMerchantLocationAutomation(Merchant $merchant): Merchant
    {
        return $merchant->fresh();
    }

    public function updateMerchantLocationAutomation(Merchant $merchant, array $data): Merchant
    {
        return DB::transaction(function () use ($merchant, $data) {
            if (array_key_exists('enabled', $data)) {
                $merchant->allow_auto_shipment_creations_at_locations = (bool) $data['enabled'];
            }

            if (array_key_exists('location_types', $data)) {
                $typeMap = LocationType::query()
                    ->where('merchant_id', $merchant->id)
                    ->whereIn('uuid', collect($data['location_types'])->pluck('location_type_id')->filter()->all())
                    ->get()
                    ->keyBy('uuid');

                $merchant->location_automation_settings = [
                    'location_types' => collect($data['location_types'])->map(function (array $rule) use ($typeMap) {
                        $locationType = $typeMap->get($rule['location_type_id']);

                        return [
                            'location_type_id' => $rule['location_type_id'],
                            'location_type_name' => $locationType?->title,
                            'location_type_slug' => $locationType?->slug,
                            'location_type_icon' => $locationType?->icon,
                            'location_type_color' => $locationType?->color,
                            'entry' => $this->normalizeLocationAutomationActions($rule['entry'] ?? []),
                            'exit' => $this->normalizeLocationAutomationActions($rule['exit'] ?? []),
                        ];
                    })->values()->all(),
                ];
            }

            $merchant->save();

            return $merchant->fresh();
        });
    }

    private function normalizeLocationAutomationActions(array $actions): array
    {
        return collect($actions)->map(function (array $action) {
            return [
                'id' => (string) $action['id'],
                'action' => (string) $action['action'],
                'conditions' => collect($action['conditions'] ?? [])->map(function (array $condition) {
                    return [
                        'id' => (string) $condition['id'],
                        'field' => (string) $condition['field'],
                        'operator' => (string) $condition['operator'],
                        'value' => (string) $condition['value'],
                    ];
                })->values()->all(),
            ];
        })->values()->all();
    }

    public function listMembers(Merchant $merchant, int $perPage = 15): LengthAwarePaginator
    {
        $page = Paginator::resolveCurrentPage();
        $perPage = min($perPage, 100);

        $members = $merchant->users()
            ->get()
            ->map(function (User $user) {
                $user->setAttribute('effective_role', MerchantAccess::normalizeRole($user->pivot->role ?? null));
                return $user;
            });

        $accountHolder = $merchant->account?->owner;
        if ($accountHolder && !$members->contains(fn (User $user) => (int) $user->id === (int) $accountHolder->id)) {
            $accountHolder->setRelation('pivot', null);
            $accountHolder->setAttribute('effective_role', MerchantAccess::ROLE_ACCOUNT_HOLDER);
            $members->prepend($accountHolder);
        }

        return $this->paginateCollection($members->values(), $perPage, $page);
    }

    public function updateMemberRole(Merchant $merchant, User $member, string $role): void
    {
        if (MerchantAccess::isAccountHolder($member, $merchant)) {
            throw new \InvalidArgumentException('Account holder role cannot be changed from merchant membership management.');
        }

        $merchant->users()->updateExistingPivot($member->id, ['role' => MerchantAccess::normalizeRole($role) ?? $role]);
    }

    public function removeMember(Merchant $merchant, User $member): void
    {
        if (MerchantAccess::isAccountHolder($member, $merchant)) {
            throw new \InvalidArgumentException('Account holder cannot be removed from a merchant.');
        }

        $merchant->users()->detach($member->id);
    }

    private function paginateCollection(Collection $items, int $perPage, int $page): LengthAwarePaginator
    {
        $total = $items->count();
        $results = $items->slice(($page - 1) * $perPage, $perPage)->values();

        return new Paginator(
            $results,
            $total,
            $perPage,
            $page,
            ['path' => Paginator::resolveCurrentPath()]
        );
    }
}
