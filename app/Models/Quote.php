<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Quote extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_order_ref',
        'merchant_id',
        'environment_id',
        'shipment_id',
        'status',
        'requested_at',
        'collection_date',
        'expires_at',
    ];

    protected $casts = [
        'requested_at' => 'datetime',
        'collection_date' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function options()
    {
        return $this->hasMany(QuoteOption::class);
    }

    public function booking()
    {
        return $this->hasOne(Booking::class, 'shipment_id', 'shipment_id');
    }

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function environment()
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }
}
