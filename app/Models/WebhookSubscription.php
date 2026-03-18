<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class WebhookSubscription extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'url',
        'secret',
        'event_types',
        'status',
    ];

    protected $casts = [
        'event_types' => 'array',
    ];

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function deliveries()
    {
        return $this->hasMany(WebhookDelivery::class);
    }
}
