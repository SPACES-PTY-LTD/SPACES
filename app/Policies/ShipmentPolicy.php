<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Support\MerchantAccess;

class ShipmentPolicy
{
    public function view(User $user, Shipment $shipment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $shipment->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $merchant);
    }

    public function update(User $user, Shipment $shipment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $shipment->merchant);
    }

    public function delete(User $user, Shipment $shipment): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canDeleteResources($user, $shipment->merchant);
    }
}
