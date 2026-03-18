<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\Run;
use App\Models\User;
use App\Support\MerchantAccess;

class RunPolicy
{
    public function view(User $user, Run $run): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $run->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $merchant);
    }

    public function update(User $user, Run $run): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $run->merchant);
    }
}
