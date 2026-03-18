<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrackingProvider extends Model
{
    use HasFactory, HasUuid;

    protected $fillable = [
        'uuid',
        'name',
        'status',
        'logo_file_name',
        'website',
        'documentation',
        'supports_bulk_vehicle_requests',
        'default_tracking',
        'has_driver_importing',
        'has_locations_importing',
        'has_vehicle_importing',
    ];

    protected $casts = [
        'supports_bulk_vehicle_requests' => 'boolean',
        'default_tracking' => 'boolean',
        'has_driver_importing' => 'boolean',
        'has_locations_importing' => 'boolean',
        'has_vehicle_importing' => 'boolean',
    ];

    public function formFields()
    {
        return $this->hasMany(TrackingProviderIntegrationFormField::class, 'provider_id');
    }

    public function options()
    {
        return $this->hasMany(TrackingProviderOption::class, 'provider_id');
    }

    public function merchantIntegrations()
    {
        return $this->hasMany(MerchantIntegration::class, 'provider_id');
    }
}
