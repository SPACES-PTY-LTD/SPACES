<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Location extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'name',
        'code',
        'company',
        'full_address',
        'address_line_1',
        'address_line_2',
        'town',
        'city',
        'country',
        'first_name',
        'last_name',
        'phone',
        'email',
        'province',
        'post_code',
        'latitude',
        'longitude',
        'polygon_bounds',
        'google_place_id',
        'location_type_id',
        'metadata',
        'intergration_id',
        'imported_at',
    ];

    protected $casts = [
        'latitude' => 'decimal:7',
        'longitude' => 'decimal:7',
        'location_type_id' => 'integer',
        'metadata' => 'array',
        'imported_at' => 'datetime',
    ];

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function environment()
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function locationType()
    {
        return $this->belongsTo(LocationType::class);
    }

    public function toAddressArray(): array
    {
        return [
            'location_id' => $this->uuid,
            'name' => $this->name,
            'code' => $this->code,
            'company' => $this->company,
            'full_address' => $this->full_address,
            'address_line_1' => $this->address_line_1,
            'address_line_2' => $this->address_line_2,
            'town' => $this->town,
            'city' => $this->city,
            'country' => $this->country,
            'first_name' => $this->first_name,
            'last_name' => $this->last_name,
            'phone' => $this->phone,
            'email' => $this->email,
            'province' => $this->province,
            'post_code' => $this->post_code,
            'latitude' => $this->latitude,
            'longitude' => $this->longitude,
            'google_place_id' => $this->google_place_id,
        ];
    }
}
