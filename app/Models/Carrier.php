<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Carrier extends Model
{
    use HasFactory, SoftDeletes, HasUuid;

    protected $fillable = [
        'uuid',
        'code',
        'name',
        'type',
        'enabled',
        'settings',
        'merchant_id',
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'settings' => 'array',
    ];

    public function drivers()
    {
        return $this->hasMany(Driver::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }
}
