<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LocationType extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'slug',
        'title',
        'collection_point',
        'delivery_point',
        'sequence',
        'icon',
        'color',
        'default',
    ];

    protected $casts = [
        'collection_point' => 'boolean',
        'delivery_point' => 'boolean',
        'sequence' => 'integer',
        'default' => 'boolean',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }
}
