<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AccountInvoiceLine extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'account_invoice_id',
        'merchant_id',
        'plan_id',
        'type',
        'description',
        'quantity',
        'unit_amount',
        'subtotal',
        'included_vehicles',
        'billable_vehicles',
        'snapshot',
    ];

    protected $casts = [
        'unit_amount' => 'decimal:2',
        'subtotal' => 'decimal:2',
        'snapshot' => 'array',
    ];

    public function invoice()
    {
        return $this->belongsTo(AccountInvoice::class, 'account_invoice_id');
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function plan()
    {
        return $this->belongsTo(PricingPlan::class);
    }
}
