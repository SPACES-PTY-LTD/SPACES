<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountInvoicePaymentAttempt extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_invoice_id',
        'account_id',
        'payment_gateway_id',
        'payment_method_id',
        'gateway_code',
        'status',
        'provider_transaction_id',
        'provider_reference',
        'amount',
        'request_payload',
        'response_payload',
        'failure_reason',
        'processed_at',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'request_payload' => 'array',
        'response_payload' => 'array',
        'processed_at' => 'datetime',
    ];

    public function invoice()
    {
        return $this->belongsTo(AccountInvoice::class, 'account_invoice_id');
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function paymentGateway()
    {
        return $this->belongsTo(PaymentGateway::class);
    }

    public function paymentMethod()
    {
        return $this->belongsTo(AccountPaymentMethod::class, 'payment_method_id');
    }
}
