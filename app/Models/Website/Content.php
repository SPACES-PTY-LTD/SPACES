<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $table = 'website_contents';

    protected $guarded = ['id'];

    protected $casts = ['draft' => 'array', 'published' => 'array', 'published_at' => 'datetime'];
}
