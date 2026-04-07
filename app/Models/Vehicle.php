<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use App\Models\Merchant;
use App\Models\Run;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphToMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Vehicle extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'vehicle_type_id',
        'make',
        'model',
        'color',
        'plate_number',
        'vin_number',
        'engine_number',
        'ref_code',
        'odometer',
        'year',
        'last_location_address',
        'location_updated_at',
        'last_driver_id',
        'driver_logged_at',
        'intergration_id',
        'imported_at',
        'maintenance_mode_at',
        'maintenance_expected_resolved_at',
        'maintenance_description',
        'photo_key',
        'is_active',
        'metadata',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'odometer' => 'integer',
        'year' => 'integer',
        'metadata' => 'array',
        'location_updated_at' => 'datetime',
        'driver_logged_at' => 'datetime',
        'imported_at' => 'datetime',
        'maintenance_mode_at' => 'datetime',
        'maintenance_expected_resolved_at' => 'datetime',
        'last_location_address' => 'array',
    ];

    public function vehicleType()
    {
        return $this->belongsTo(VehicleType::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function drivers()
    {
        return $this->belongsToMany(Driver::class, 'driver_vehicles');
    }

    public function runs()
    {
        return $this->hasMany(Run::class);
    }

    public function activeRuns(): HasMany
    {
        return $this->hasMany(Run::class)->whereIn('status', [
            Run::STATUS_DRAFT,
            Run::STATUS_DISPATCHED,
            Run::STATUS_IN_PROGRESS,
        ]);
    }

    public function lastDriver()
    {
        return $this->belongsTo(Driver::class, 'last_driver_id');
    }

    public function files(): MorphMany
    {
        return $this->morphMany(EntityFile::class, 'attachable');
    }

    public function tags(): MorphToMany
    {
        return $this->morphToMany(Tag::class, 'taggable')->withTimestamps()->orderBy('name');
    }
}
