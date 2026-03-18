<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\User;

class ShipmentParcel extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'shipment_id',
        'parcel_code',
        'weight',
        'weight_measurement',
        'type',
        'length_cm',
        'width_cm',
        'height_cm',
        'declared_value',
        'contents_description',
        'picked_up_scanned_at',
        'picked_up_scanned_by_user_id',
    ];

    protected $casts = [
        'weight' => 'decimal:3',
        'length_cm' => 'decimal:2',
        'width_cm' => 'decimal:2',
        'height_cm' => 'decimal:2',
        'declared_value' => 'decimal:2',
        'picked_up_scanned_at' => 'datetime',
    ];

    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    public function pickedUpScannedBy()
    {
        return $this->belongsTo(User::class, 'picked_up_scanned_by_user_id');
    }
}
