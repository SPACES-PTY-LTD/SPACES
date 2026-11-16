<?php

namespace App\Models\Website;

use Illuminate\Database\Eloquent\Model;

class DemoBooking extends Model
{
    protected $table = 'demo_bookings';

    protected $guarded = ['id'];

    protected $casts = ['starts_at' => 'immutable_datetime', 'token_expires_at' => 'immutable_datetime', 'reminded_at' => 'datetime'];

    use \Illuminate\Database\Eloquent\Concerns\HasUuids;

    protected $attributes = ['status' => 'confirmed'];

    protected $hidden = ['token_hash'];
}
