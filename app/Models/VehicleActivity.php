<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VehicleActivity extends Model
{
    use HasFactory, HasUuid;

    public const EVENT_SPEEDING = 'speeding';
    public const EVENT_STOPPED = 'stopped';
    public const EVENT_MOVING = 'moving';
    public const EVENT_ENTERED_LOCATION = 'entered_location';
    public const EVENT_EXITED_LOCATION = 'exited_location';
    public const EVENT_SHIPMENT_CREATED = 'shipment_created';
    public const EVENT_SHIPMENT_ENDED = 'shipment_ended';
    public const EVENT_SHIPMENT_COLLECTION = 'shipment_collection';
    public const EVENT_SHIPMENT_DELIVERY = 'shipment_delivery';
    public const EVENT_RUN_STARTED = 'run_started';
    public const EVENT_RUN_ENDED = 'run_ended';
    public const DRIVER_SNAPSHOT_EVENT_TYPES = [
        self::EVENT_SPEEDING,
        self::EVENT_STOPPED,
        self::EVENT_MOVING,
        self::EVENT_ENTERED_LOCATION,
        self::EVENT_EXITED_LOCATION,
    ];

    public const EXIT_REASON_LEFT_GEOFENCE = 'left_geofence';

    protected $table = 'vehicle_activity';

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'vehicle_id',
        'location_id',
        'run_id',
        'shipment_id',
        'event_type',
        'occurred_at',
        'entered_at',
        'exited_at',
        'latitude',
        'longitude',
        'speed_kph',
        'speed_limit_kph',
        'exit_reason',
        'metadata',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'entered_at' => 'datetime',
        'exited_at' => 'datetime',
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'speed_kph' => 'decimal:2',
        'speed_limit_kph' => 'decimal:2',
        'metadata' => 'array',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function vehicle(): BelongsTo
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(Location::class);
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(Run::class);
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }
}
