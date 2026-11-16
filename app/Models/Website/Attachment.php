<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class Attachment extends Model
{
    protected $table = 'support_attachments';

    protected $guarded = ['id'];

    protected $casts = [];

    use \Illuminate\Database\Eloquent\Concerns\HasUuids;
}
