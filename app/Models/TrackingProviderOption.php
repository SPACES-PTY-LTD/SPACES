<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrackingProviderOption extends Model
{
    use HasFactory, HasUuid;

    protected $table = 'tracking_providers_options';

    protected $fillable = [
        'uuid',
        'provider_id',
        'label',
        'name',
        'type',
        'options',
        'order_id',
    ];

    protected $casts = [
        'options' => 'array',
    ];

    public function provider()
    {
        return $this->belongsTo(TrackingProvider::class, 'provider_id');
    }
}
