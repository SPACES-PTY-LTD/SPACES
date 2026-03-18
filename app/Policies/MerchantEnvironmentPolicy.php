<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\User;
use App\Support\MerchantAccess;

class MerchantEnvironmentPolicy
{
    public function view(User $user, MerchantEnvironment $environment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $environment->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $merchant);
    }

    public function update(User $user, MerchantEnvironment $environment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $environment->merchant);
    }

    public function delete(User $user, MerchantEnvironment $environment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $environment->merchant);
    }
}
