<?php

namespace App\Policies;

use App\Models\Booking;
use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;

class BookingPolicy
{
    public function view(User $user, Booking $booking): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $booking->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $merchant);
    }
}
