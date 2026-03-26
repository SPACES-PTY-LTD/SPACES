<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class CountryPricing extends Model
{
    use HasFactory, HasUuid;

    protected $table = 'country_pricing';

    protected $fillable = [
        'uuid',
        'country_name',
        'country_code',
        'currency',
        'payment_gateway_id',
        'is_default',
    ];

    protected $casts = [
        'is_default' => 'boolean',
    ];

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }
}
