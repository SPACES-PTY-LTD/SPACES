<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphedByMany;

class Tag extends Model
{
    use HasFactory, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'name',
        'slug',
    ];

    public function vehicles(): MorphedByMany
    {
        return $this->morphedByMany(Vehicle::class, 'taggable')->withTimestamps();
    }

    public function locations(): MorphedByMany
    {
        return $this->morphedByMany(Location::class, 'taggable')->withTimestamps();
    }
}
