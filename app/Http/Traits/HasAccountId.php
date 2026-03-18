<?php

namespace App\Http\Traits;

use Illuminate\Support\Facades\Auth;

trait HasAccountId
{
    protected static function bootHasAccountId()
    {
        static::creating(function ($model) {
            if (!empty($model->account_id)) {
                return;
            }

            $user = Auth::user();
            if ($user && !empty($user->account_id)) {
                $model->account_id = $user->account_id;
            }

            print_r($user);
            exit();
        });
    }
}
