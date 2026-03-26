<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountInvoice extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_id',
        'invoice_number',
        'billing_period_start',
        'billing_period_end',
        'currency',
        'subtotal',
        'total',
        'invoice_status',
        'payment_status',
        'gateway_code',
        'due_date',
        'paid_at',
        'last_payment_attempt_at',
        'failure_reason',
        'metadata',
    ];

    protected $casts = [
        'billing_period_start' => 'date',
        'billing_period_end' => 'date',
        'subtotal' => 'decimal:2',
        'total' => 'decimal:2',
        'due_date' => 'date',
        'paid_at' => 'datetime',
        'last_payment_attempt_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function lines()
    {
        return $this->hasMany(AccountInvoiceLine::class);
    }

    public function paymentAttempts()
    {
        return $this->hasMany(AccountInvoicePaymentAttempt::class);
    }
}
