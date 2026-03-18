<?php

namespace App\Http\Traits;

use Illuminate\Support\Str;

trait HasUuid
{
    protected static function bootHasUuid()
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function scopeWithUuid($query, $uuid)
    {
        $query->where('uuid', $uuid);
    }
}
?>
