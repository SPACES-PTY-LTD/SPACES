<?php

namespace App\Support;

use App\Models\Account;
use App\Models\User;

class BillingAccess
{
    public static function canManageAccountBilling(User $user, Account $account): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        return !empty($user->account_id)
            && (int) $user->account_id === (int) $account->id
            && (int) $account->owner_user_id === (int) $user->id;
    }

    public static function canViewAccountBilling(User $user, Account $account): bool
    {
        if ($user->role === 'super_admin') {
            return true;
        }

        return !empty($user->account_id) && (int) $user->account_id === (int) $account->id;
    }
}
