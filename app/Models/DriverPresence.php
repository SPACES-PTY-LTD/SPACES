<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DriverPresence extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'driver_id',
        'user_device_id',
        'is_online',
        'is_available',
        'latitude',
        'longitude',
        'last_seen_at',
        'last_offered_at',
    ];

    protected $casts = [
        'is_online' => 'boolean',
        'is_available' => 'boolean',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'last_seen_at' => 'datetime',
        'last_offered_at' => 'datetime',
    ];

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function userDevice(): BelongsTo
    {
        return $this->belongsTo(UserDevice::class);
    }
}
