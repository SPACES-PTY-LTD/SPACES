<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class DeliveryRoute extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $table = 'routes';

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'title',
        'code',
        'description',
        'estimated_distance',
        'estimated_duration',
        'estimated_collection_time',
        'estimated_delivery_time',
        'auto_created',
    ];

    protected $casts = [
        'estimated_distance' => 'decimal:2',
        'estimated_duration' => 'integer',
        'estimated_collection_time' => 'integer',
        'estimated_delivery_time' => 'integer',
        'auto_created' => 'boolean',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function environment(): BelongsTo
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function routeStops(): HasMany
    {
        return $this->hasMany(RouteStop::class, 'route_id')->orderBy('sequence');
    }

    public function runs(): HasMany
    {
        return $this->hasMany(Run::class, 'route_id');
    }
}
