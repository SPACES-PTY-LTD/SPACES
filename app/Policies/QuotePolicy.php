<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\Quote;
use App\Models\User;
use App\Support\MerchantAccess;

class QuotePolicy
{
    public function view(User $user, Quote $quote): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $quote->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canCreateOrUpdateResources($user, $merchant);
    }
}
