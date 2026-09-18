<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleLocationHistory extends Model
{
    protected $table = 'vehicle_location_history';

    public $timestamps = false;

    protected $dateFormat = 'Y-m-d H:i:s.u';

    protected $guarded = [];

    protected $casts = [
        'observed_at' => 'immutable_datetime', 'last_seen_at' => 'immutable_datetime',
        'received_at' => 'immutable_datetime', 'stationary' => 'boolean', 'delayed' => 'boolean',
        'latitude' => 'float', 'longitude' => 'float', 'last_latitude' => 'float', 'last_longitude' => 'float',
    ];
}
