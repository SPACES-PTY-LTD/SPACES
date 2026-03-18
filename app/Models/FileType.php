<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class FileType extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    public const ENTITY_SHIPMENT = 'shipment';
    public const ENTITY_DRIVER = 'driver';
    public const ENTITY_VEHICLE = 'vehicle';

    public const ENTITY_TYPES = [
        self::ENTITY_SHIPMENT,
        self::ENTITY_DRIVER,
        self::ENTITY_VEHICLE,
    ];

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'entity_type',
        'name',
        'slug',
        'description',
        'requires_expiry',
        'driver_can_upload',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'requires_expiry' => 'boolean',
        'driver_can_upload' => 'boolean',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function files(): HasMany
    {
        return $this->hasMany(EntityFile::class);
    }
}
