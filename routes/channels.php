<?php

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('merchant.{merchantUuid}.vehicle-activities', function (User $user, string $merchantUuid): bool {
    if ($user->role === 'super_admin') {
        return true;
    }

    $merchant = Merchant::query()->where('uuid', $merchantUuid)->first();
    if (!$merchant) {
        return false;
    }

    if (!empty($user->account_id) && (int) $user->account_id === (int) $merchant->account_id) {
        return true;
    }

    $merchantIds = $user->merchants()->pluck('merchants.id')->all();
    $ownedMerchantIds = $user->ownedMerchants()->pluck('id')->all();
    $allowedMerchantIds = array_merge($merchantIds, $ownedMerchantIds);

    return in_array($merchant->id, $allowedMerchantIds, true);
});
