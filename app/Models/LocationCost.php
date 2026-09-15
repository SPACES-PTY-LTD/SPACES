<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LocationCost extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = ['title', 'amount', 'currency', 'location_id'];

    protected $casts = ['amount' => 'decimal:4'];

    public function location()
    {
        return $this->belongsTo(Location::class);
    }
}
