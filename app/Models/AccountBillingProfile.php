<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountBillingProfile extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_id',
        'payment_gateway_id',
        'gateway_code',
        'gateway_customer_id',
        'gateway_reference',
        'gateway_metadata',
        'last_synced_at',
    ];

    protected $casts = [
        'gateway_metadata' => 'array',
        'last_synced_at' => 'datetime',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }
}
