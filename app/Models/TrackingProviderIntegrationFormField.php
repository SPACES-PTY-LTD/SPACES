<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TrackingProviderIntegrationFormField extends Model
{
    use HasFactory, HasUuid;

    protected $table = 'tracking_providers_integration_form_fields';

    protected $fillable = [
        'uuid',
        'provider_id',
        'label',
        'name',
        'type',
        'is_required',
        'options',
        'order_id',
    ];

    protected $casts = [
        'options' => 'array',
        'is_required' => 'boolean',
    ];

    public function provider()
    {
        return $this->belongsTo(TrackingProvider::class, 'provider_id');
    }
}
