<?php

namespace App\Services;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class ActivityLogService
{
    public function log(
        string $action,
        string $entityType,
        ?Model $entity = null,
        ?User $actor = null,
        ?int $accountId = null,
        ?int $merchantId = null,
        ?int $environmentId = null,
        array $changes = [],
        array $metadata = [],
        ?string $title = null
    ): ActivityLog {
        $actor = $actor ?: request()->user();
        $accountId = $accountId ?? $actor?->account_id ?? ($entity->account_id ?? null);
        $merchantId = $merchantId ?? ($entity->merchant_id ?? null);
        $environmentId = $environmentId ?? ($entity->environment_id ?? null);

        return ActivityLog::create([
            'account_id' => $accountId,
            'merchant_id' => $merchantId,
            'environment_id' => $environmentId,
            'actor_user_id' => $actor?->id,
            'action' => $action,
            'entity_type' => $entityType,
            'entity_id' => $entity?->id,
            'entity_uuid' => $entity?->uuid,
            'title' => $title,
            'changes' => !empty($changes) ? $changes : null,
            'metadata' => !empty($metadata) ? $metadata : null,
            'request_id' => (string) request()->attributes->get('request_id', ''),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'occurred_at' => now(),
        ]);
    }

    public function listActivities(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->scopedQuery($user)->orderByDesc('occurred_at');

        if (!empty($filters['account_id'])) {
            $accountId = Account::query()->where('uuid', $filters['account_id'])->value('id');
            if ($accountId) {
                $query->where('account_id', $accountId);
            } else {
                $query->whereRaw('1=0');
            }
        }

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()->where('uuid', $filters['merchant_id'])->value('id');
            if ($merchantId) {
                $query->where('merchant_id', $merchantId);
            } else {
                $query->whereRaw('1=0');
            }
        }

        if (array_key_exists('environment_id', $filters)) {
            if (!empty($filters['environment_id'])) {
                $environmentId = MerchantEnvironment::query()
                    ->where('uuid', $filters['environment_id'])
                    ->value('id');
                if ($environmentId) {
                    $query->where('environment_id', $environmentId);
                } else {
                    $query->whereRaw('1=0');
                }
            } else {
                $query->whereNull('environment_id');
            }
        }

        if (!empty($filters['actor_user_id'])) {
            $actorUserId = User::query()->where('uuid', $filters['actor_user_id'])->value('id');
            if ($actorUserId) {
                $query->where('actor_user_id', $actorUserId);
            } else {
                $query->whereRaw('1=0');
            }
        }

        if (!empty($filters['action'])) {
            $query->where('action', $filters['action']);
        }

        if (!empty($filters['entity_type'])) {
            $query->where('entity_type', $filters['entity_type']);
        }

        if (!empty($filters['entity_id'])) {
            $query->where('entity_uuid', $filters['entity_id']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('occurred_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('occurred_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $query->paginate($perPage);
    }

    public function getActivity(User $user, string $activityUuid): ActivityLog
    {
        return $this->scopedQuery($user)
            ->where('uuid', $activityUuid)
            ->firstOrFail();
    }

    public function diffChanges(array $before, array $after): array
    {
        $changes = [];
        $keys = array_values(array_unique(array_merge(array_keys($before), array_keys($after))));

        foreach ($keys as $key) {
            $oldValue = $before[$key] ?? null;
            $newValue = $after[$key] ?? null;

            if ($oldValue !== $newValue) {
                $changes[$key] = [
                    'from' => $this->normalizeValue($oldValue),
                    'to' => $this->normalizeValue($newValue),
                ];
            }
        }

        return $changes;
    }

    private function normalizeValue($value)
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format(\DateTimeInterface::ATOM);
        }

        return $value;
    }

    private function scopedQuery(User $user): Builder
    {
        $query = ActivityLog::query()->with(['account', 'merchant', 'environment', 'actor']);

        if ($user->role === 'super_admin') {
            return $query;
        }

        return MerchantAccess::scopeToMerchants($query, $user);
    }
}
