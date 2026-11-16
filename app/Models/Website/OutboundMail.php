<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class OutboundMail extends Model
{
    protected $table = 'website_mail';

    protected $guarded = ['id'];

    protected $casts = ['attempted_at' => 'datetime', 'body' => 'encrypted', 'calendar' => 'encrypted'];

    use \Illuminate\Database\Eloquent\Concerns\HasUuids;
}
