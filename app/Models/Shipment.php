<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shipment extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'merchant_order_ref',
        'delivery_note_number',
        'invoice_number',
        'invoiced_at',
        'status',
        'pickup_location_id',
        'dropoff_location_id',
        'requested_vehicle_type_id',
        'pickup_instructions',
        'dropoff_instructions',
        'ready_at',
        'collection_date',
        'service_type',
        'priority',
        'auto_assign',
        'auto_created',
        'notes',
        'metadata',
    ];

    protected $casts = [
        'ready_at' => 'datetime',
        'collection_date' => 'datetime',
        'invoiced_at' => 'datetime',
        'auto_assign' => 'boolean',
        'auto_created' => 'boolean',
        'metadata' => 'array',
    ];

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function environment()
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function parcels()
    {
        return $this->hasMany(ShipmentParcel::class);
    }

    public function pickupLocation()
    {
        return $this->belongsTo(Location::class, 'pickup_location_id');
    }

    public function dropoffLocation()
    {
        return $this->belongsTo(Location::class, 'dropoff_location_id');
    }

    public function requestedVehicleType()
    {
        return $this->belongsTo(VehicleType::class, 'requested_vehicle_type_id');
    }

    public function quotes()
    {
        return $this->hasMany(Quote::class);
    }

    public function latestQuote()
    {
        return $this->hasOne(Quote::class)->latestOfMany();
    }

    public function booking()
    {
        return $this->hasOne(Booking::class);
    }

    public function trackingEvents()
    {
        return $this->hasMany(TrackingEvent::class);
    }

    public function vehicleActivities(): HasMany
    {
        return $this->hasMany(VehicleActivity::class)
            ->orderBy('occurred_at')
            ->orderBy('id');
    }

    public function latestVehicleActivity(): HasOne
    {
        return $this->hasOne(VehicleActivity::class)
            ->ofMany([
                'occurred_at' => 'max',
                'id' => 'max',
            ]);
    }

    public function runs(): BelongsToMany
    {
        return $this->belongsToMany(Run::class, 'run_shipments')
            ->withPivot(['uuid', 'sequence', 'pickup_stop_order', 'dropoff_stop_order', 'status'])
            ->withTimestamps();
    }

    public function runShipments(): HasMany
    {
        return $this->hasMany(RunShipment::class);
    }

    public function currentRunShipment(): HasOne
    {
        return $this->hasOne(RunShipment::class)
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('run', function ($query) {
                $query->whereIn('status', [
                    Run::STATUS_DRAFT,
                    Run::STATUS_DISPATCHED,
                    Run::STATUS_IN_PROGRESS,
                ]);
            })
            ->latestOfMany();
    }

    public function deliveryOffers(): HasMany
    {
        return $this->hasMany(DeliveryOffer::class)->orderByDesc('created_at');
    }

    public function files(): MorphMany
    {
        return $this->morphMany(EntityFile::class, 'attachable');
    }

    public function pickupAddressArray(): array
    {
        return $this->pickupLocation?->toAddressArray() ?? [];
    }

    public function dropoffAddressArray(): array
    {
        return $this->dropoffLocation?->toAddressArray() ?? [];
    }
}
