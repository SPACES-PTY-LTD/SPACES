<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountPaymentMethod extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_id',
        'billing_profile_id',
        'payment_gateway_id',
        'gateway_code',
        'gateway_customer_id',
        'gateway_payment_method_id',
        'gateway_reference',
        'brand',
        'last_four',
        'expiry_month',
        'expiry_year',
        'funding_type',
        'bank',
        'signature',
        'is_reusable',
        'retrieved_from_gateway',
        'is_default',
        'status',
        'verified_at',
        'gateway_metadata',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'is_reusable' => 'boolean',
        'retrieved_from_gateway' => 'boolean',
        'verified_at' => 'datetime',
        'gateway_metadata' => 'array',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function billingProfile()
    {
        return $this->belongsTo(AccountBillingProfile::class, 'billing_profile_id');
    }

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }
}
