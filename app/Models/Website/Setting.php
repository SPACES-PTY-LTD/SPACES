<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $table = 'website_settings';

    protected $guarded = ['id'];

    protected $casts = ['data' => 'array'];
}
