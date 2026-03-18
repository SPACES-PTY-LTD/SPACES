<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Driver extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'user_id',
        'carrier_id',
        'vehicle_type_id',
        'intergration_id',
        'imported_at',
        'is_active',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'metadata' => 'array',
        'imported_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function carrier()
    {
        return $this->belongsTo(Carrier::class);
    }

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function vehicles()
    {
        return $this->belongsToMany(Vehicle::class, 'driver_vehicles');
    }

    public function driverVehicles()
    {
        return $this->hasMany(DriverVehicle::class);
    }

    public function assignments()
    {
        return $this->hasMany(DriverAssignment::class);
    }

    public function runs()
    {
        return $this->hasMany(Run::class);
    }

    public function presence()
    {
        return $this->hasOne(DriverPresence::class);
    }

    public function deliveryOffers()
    {
        return $this->hasMany(DeliveryOffer::class);
    }

    public function files(): MorphMany
    {
        return $this->morphMany(EntityFile::class, 'attachable');
    }
}
