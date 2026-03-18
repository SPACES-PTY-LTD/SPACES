<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Booking extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'shipment_id',
        'quote_option_id',
        'current_driver_id',
        'status',
        'carrier_code',
        'carrier_job_id',
        'label_url',
        'booked_at',
        'collected_at',
        'delivered_at',
        'returned_at',
        'cancelled_at',
        'odometer_at_request',
        'odometer_at_collection',
        'odometer_at_delivery',
        'odometer_at_return',
        'total_km_from_collection',
        'cancellation_reason_code',
        'cancellation_reason_note',
        'cancel_reason',
    ];

    protected $casts = [
        'booked_at' => 'datetime',
        'collected_at' => 'datetime',
        'delivered_at' => 'datetime',
        'returned_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'odometer_at_request' => 'integer',
        'odometer_at_collection' => 'integer',
        'odometer_at_delivery' => 'integer',
        'odometer_at_return' => 'integer',
        'total_km_from_collection' => 'decimal:2',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function quoteOption()
    {
        return $this->belongsTo(QuoteOption::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function environment()
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function currentDriver()
    {
        return $this->belongsTo(Driver::class, 'current_driver_id');
    }

    public function assignments()
    {
        return $this->hasMany(DriverAssignment::class);
    }

    public function pod()
    {
        return $this->hasOne(BookingPod::class);
    }
}
