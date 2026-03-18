<?php

namespace App\Policies;

use App\Models\Merchant;
use App\Models\User;
use App\Models\WebhookSubscription;
use App\Support\MerchantAccess;

class WebhookSubscriptionPolicy
{
    public function view(User $user, WebhookSubscription $subscription): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canViewResources($user, $subscription->merchant);
    }

    public function create(User $user, Merchant $merchant): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $merchant);
    }

    public function delete(User $user, WebhookSubscription $subscription): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $subscription->merchant);
    }

    public function update(User $user, WebhookSubscription $subscription): bool
    {
        return MerchantAccess::isSuperAdmin($user) || MerchantAccess::canManageMerchant($user, $subscription->merchant);
    }
}
