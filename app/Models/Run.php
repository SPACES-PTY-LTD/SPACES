<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class Run extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_DISPATCHED = 'dispatched';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'driver_id',
        'vehicle_id',
        'origin_location_id',
        'destination_location_id',
        'route_id',
        'status',
        'auto_created',
        'planned_start_at',
        'started_at',
        'origin_departure_time',
        'completed_at',
        'service_area',
        'notes',
    ];

    protected $casts = [
        'planned_start_at' => 'datetime',
        'started_at' => 'datetime',
        'origin_departure_time' => 'datetime',
        'completed_at' => 'datetime',
        'auto_created' => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function environment(): BelongsTo
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(Driver::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function originLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'origin_location_id');
    }

    public function destinationLocation(): BelongsTo
    {
        return $this->belongsTo(Location::class, 'destination_location_id');
    }

    public function route(): BelongsTo
    {
        return $this->belongsTo(DeliveryRoute::class, 'route_id');
    }

    public function runShipments(): HasMany
    {
        return $this->hasMany(RunShipment::class);
    }

    public function latestLocationStop(): HasOne
    {
        return $this->hasOne(VehicleActivity::class)
            ->ofMany([
                'occurred_at' => 'max',
                'id' => 'max',
            ], function ($query) {
                $query->whereNotNull('location_id');
            });
    }

    public function vehicleActivities(): HasMany
    {
        return $this->hasMany(VehicleActivity::class)
            ->orderBy('occurred_at')
            ->orderBy('id');
    }

    public function shipments(): BelongsToMany
    {
        return $this->belongsToMany(Shipment::class, 'run_shipments')
            ->withPivot(['uuid', 'sequence', 'pickup_stop_order', 'dropoff_stop_order', 'status'])
            ->withTimestamps();
    }

    public function isMutable(): bool
    {
        return in_array($this->status, [self::STATUS_DRAFT, self::STATUS_DISPATCHED], true);
    }
}
