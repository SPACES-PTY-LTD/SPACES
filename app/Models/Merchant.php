<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Merchant extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'owner_user_id',
        'name',
        'legal_name',
        'status',
        'billing_email',
        'support_email',
        'max_driver_distance',
        'delivery_offers_expiry_time',
        'driver_offline_timeout_minutes',
        'default_webhook_url',
        'timezone',
        'operating_countries',
        'allow_auto_shipment_creations_at_locations',
        'location_automation_settings',
        'setup_completed_at',
        'imports_stats',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
        'operating_countries' => 'array',
        'allow_auto_shipment_creations_at_locations' => 'boolean',
        'location_automation_settings' => 'array',
        'max_driver_distance' => 'decimal:2',
        'setup_completed_at' => 'datetime',
        'imports_stats' => 'array',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function users()
    {
        return $this->belongsToMany(User::class)
            ->withPivot(['role'])
            ->withTimestamps();
    }

    public function shipments()
    {
        return $this->hasMany(Shipment::class);
    }

    public function webhookSubscriptions()
    {
        return $this->hasMany(WebhookSubscription::class);
    }

    public function environments()
    {
        return $this->hasMany(MerchantEnvironment::class);
    }

    public function runs()
    {
        return $this->hasMany(Run::class);
    }

    public function routes()
    {
        return $this->hasMany(DeliveryRoute::class, 'merchant_id');
    }

    public function deliveryOffers()
    {
        return $this->hasMany(DeliveryOffer::class);
    }

    public function fileTypes()
    {
        return $this->hasMany(FileType::class);
    }

    public function files()
    {
        return $this->hasMany(EntityFile::class);
    }
}
