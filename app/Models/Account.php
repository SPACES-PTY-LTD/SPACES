<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Account extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'owner_user_id',
        'country_code',
        'is_billing_exempt',
    ];

    protected $casts = [
        'is_billing_exempt' => 'boolean',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function users()
    {
        return $this->hasMany(User::class);
    }

    public function merchants()
    {
        return $this->hasMany(Merchant::class);
    }

    public function billingProfile()
    {
        return $this->hasOne(AccountBillingProfile::class);
    }

    public function paymentMethods()
    {
        return $this->hasMany(AccountPaymentMethod::class);
    }

    public function invoices()
    {
        return $this->hasMany(AccountInvoice::class);
    }
}
