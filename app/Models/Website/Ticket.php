<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class Ticket extends Model
{
    protected $table = 'support_tickets';

    protected $guarded = ['id'];

    protected $casts = [];

    use \Illuminate\Database\Eloquent\Concerns\HasUuids;
}
