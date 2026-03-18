<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TrackingEvent extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'shipment_id',
        'booking_id',
        'event_code',
        'event_description',
        'occurred_at',
        'payload',
    ];

    protected $casts = [
        'occurred_at' => 'datetime',
        'payload' => 'array',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }
}
