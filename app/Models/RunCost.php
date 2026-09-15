<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class RunCost extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = ['title', 'amount', 'currency', 'run_id', 'location_id', 'location_cost_id', 'vehicle_activity_id', 'location_name', 'visited_at', 'source', 'created_by', 'updated_by'];

    protected $casts = ['amount' => 'decimal:4', 'visited_at' => 'datetime'];

    public function run()
    {
        return $this->belongsTo(Run::class);
    }
}
