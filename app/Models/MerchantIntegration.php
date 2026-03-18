<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MerchantIntegration extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'provider_id',
        'integration_data',
        'integration_options_data',
    ];

    protected $casts = [
        'integration_data' => 'encrypted:array',
        'integration_options_data' => 'array',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function provider()
    {
        return $this->belongsTo(TrackingProvider::class, 'provider_id');
    }
}
