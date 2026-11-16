<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class Reply extends Model
{
    protected $table = 'support_replies';

    protected $guarded = ['id'];

    protected $casts = [];

    use \Illuminate\Database\Eloquent\Concerns\HasUuids;
}
