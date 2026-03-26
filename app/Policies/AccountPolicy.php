<?php

namespace App\Policies;

use App\Models\Account;
use App\Models\User;
use App\Support\BillingAccess;

class AccountPolicy
{
    public function viewBilling(User $user, Account $account): bool
    {
        return BillingAccess::canViewAccountBilling($user, $account);
    }

    public function manageBilling(User $user, Account $account): bool
    {
        return BillingAccess::canManageAccountBilling($user, $account);
    }
}
