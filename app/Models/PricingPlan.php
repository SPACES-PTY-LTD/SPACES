<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PricingPlan extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'title',
        'vehicle_limit',
        'monthly_charge_zar',
        'monthly_charge_usd',
        'extra_vehicle_price_zar',
        'extra_vehicle_price_usd',
        'is_free',
        'trial_days',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'is_free' => 'boolean',
        'is_active' => 'boolean',
        'trial_days' => 'integer',
        'monthly_charge_zar' => 'decimal:2',
        'monthly_charge_usd' => 'decimal:2',
        'extra_vehicle_price_zar' => 'decimal:2',
        'extra_vehicle_price_usd' => 'decimal:2',
    ];
}
