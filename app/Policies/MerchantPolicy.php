<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;

class MerchantPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::hasMerchantAccess($user, $merchant);
    }

    public function create(User $user): bool
    {
        return MerchantAccess::canCreateMerchants($user);
    }

    public function update(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $merchant);
    }

    public function delete(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canDeleteMerchant($user, $merchant);
    }

    public function viewUsers(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageUsers($user, $merchant);
    }

    public function manageUsers(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageUsers($user, $merchant);
    }
}
