<?php

namespace App\Support;

use App\Models\Account;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

class MerchantAccess
{
    public const ROLE_ACCOUNT_HOLDER = 'account_holder';
    public const ROLE_MEMBER = 'member';
    public const ROLE_MODIFIER = 'modifier';
    public const ROLE_BILLER = 'biller';
    public const ROLE_RESOURCE_VIEWER = 'resource_viewer';

    public const ASSIGNABLE_ROLES = [
        self::ROLE_MEMBER,
        self::ROLE_MODIFIER,
        self::ROLE_BILLER,
        self::ROLE_RESOURCE_VIEWER,
    ];

    public const LEGACY_ASSIGNABLE_ROLES = [
        'admin',
        'developer',
        'billing',
        'read_only',
    ];

    public static function isSuperAdmin(User $user): bool
    {
        return $user->role === 'super_admin';
    }

    public static function canCreateMerchants(User $user): bool
    {
        if (self::isSuperAdmin($user)) {
            return true;
        }

        if (empty($user->account_id)) {
            return true;
        }

        return (int) self::accountOwnerId($user->account_id) === (int) $user->id;
    }

    public static function isAccountHolder(User $user, Merchant $merchant): bool
    {
        if (self::isSuperAdmin($user) || empty($user->account_id) || empty($merchant->account_id)) {
            return false;
        }

        if ((int) $user->account_id !== (int) $merchant->account_id) {
            return false;
        }

        return (int) self::accountOwnerId((int) $merchant->account_id) === (int) $user->id;
    }

    public static function roleFor(User $user, Merchant $merchant): ?string
    {
        if (self::isSuperAdmin($user)) {
            return 'super_admin';
        }

        if (self::isAccountHolder($user, $merchant)) {
            return self::ROLE_ACCOUNT_HOLDER;
        }

        $storedRole = $merchant->users()
            ->where('users.id', $user->id)
            ->value('merchant_user.role');

        if ($storedRole === null && (int) $merchant->owner_user_id === (int) $user->id) {
            $storedRole = 'owner';
        }

        return self::normalizeRole($storedRole);
    }

    public static function normalizeRole(?string $role): ?string
    {
        return match ($role) {
            self::ROLE_ACCOUNT_HOLDER,
            self::ROLE_MEMBER,
            self::ROLE_MODIFIER,
            self::ROLE_BILLER,
            self::ROLE_RESOURCE_VIEWER => $role,
            'owner', 'admin' => self::ROLE_MEMBER,
            'developer' => self::ROLE_MODIFIER,
            'billing' => self::ROLE_BILLER,
            'read_only' => self::ROLE_RESOURCE_VIEWER,
            default => null,
        };
    }

    public static function hasMerchantAccess(User $user, Merchant $merchant): bool
    {
        return self::roleFor($user, $merchant) !== null;
    }

    public static function canManageUsers(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [self::ROLE_ACCOUNT_HOLDER, self::ROLE_MEMBER], true);
    }

    public static function canManageMerchant(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [self::ROLE_ACCOUNT_HOLDER, self::ROLE_MEMBER], true);
    }

    public static function canDeleteMerchant(User $user, Merchant $merchant): bool
    {
        return self::roleFor($user, $merchant) === self::ROLE_ACCOUNT_HOLDER;
    }

    public static function canViewResources(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [
            self::ROLE_ACCOUNT_HOLDER,
            self::ROLE_MEMBER,
            self::ROLE_MODIFIER,
            self::ROLE_RESOURCE_VIEWER,
        ], true);
    }

    public static function canCreateOrUpdateResources(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [
            self::ROLE_ACCOUNT_HOLDER,
            self::ROLE_MEMBER,
            self::ROLE_MODIFIER,
        ], true);
    }

    public static function canDeleteResources(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [
            self::ROLE_ACCOUNT_HOLDER,
            self::ROLE_MEMBER,
        ], true);
    }

    public static function canAccessBilling(User $user, Merchant $merchant): bool
    {
        return in_array(self::roleFor($user, $merchant), [
            self::ROLE_ACCOUNT_HOLDER,
            self::ROLE_MEMBER,
            self::ROLE_BILLER,
        ], true);
    }

    public static function permissionsFor(User $user, Merchant $merchant): array
    {
        return [
            'can_manage_users' => self::canManageUsers($user, $merchant),
            'can_manage_merchant' => self::canManageMerchant($user, $merchant),
            'can_delete_merchant' => self::canDeleteMerchant($user, $merchant),
            'can_view_resources' => self::canViewResources($user, $merchant),
            'can_create_update_resources' => self::canCreateOrUpdateResources($user, $merchant),
            'can_delete_resources' => self::canDeleteResources($user, $merchant),
            'can_access_billing' => self::canAccessBilling($user, $merchant),
        ];
    }

    public static function accessibleMerchantIds(User $user): ?array
    {
        if (self::isSuperAdmin($user)) {
            return null;
        }

        if (self::canCreateMerchants($user) && !empty($user->account_id)) {
            return Merchant::query()
                ->where('account_id', $user->account_id)
                ->pluck('id')
                ->map(static fn ($id) => (int) $id)
                ->all();
        }

        $membershipIds = $user->merchants()->pluck('merchants.id')->map(static fn ($id) => (int) $id)->all();
        $ownedMerchantIds = $user->ownedMerchants()->pluck('id')->map(static fn ($id) => (int) $id)->all();

        return array_values(array_unique(array_merge($membershipIds, $ownedMerchantIds)));
    }

    public static function scopeToMerchants(Builder $query, User $user, string $column = 'merchant_id'): Builder
    {
        $merchantIds = self::accessibleMerchantIds($user);

        if ($merchantIds === null) {
            return $query;
        }

        if ($merchantIds === []) {
            return $query->whereRaw('1 = 0');
        }

        return $query->whereIn($column, $merchantIds);
    }

    private static function accountOwnerId(int $accountId): ?int
    {
        return Account::query()->whereKey($accountId)->value('owner_user_id');
    }
}
