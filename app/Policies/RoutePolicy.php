<?php

namespace App\Policies;

use App\Models\DeliveryRoute;
use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;

class RoutePolicy
{
    public function view(User $user, DeliveryRoute $route): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $route->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $merchant);
    }

    public function update(User $user, DeliveryRoute $route): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $route->merchant);
    }
}
