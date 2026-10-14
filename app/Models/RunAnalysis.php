<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RunAnalysis extends Model
{
    use HasUuid;

    protected $guarded = ['id'];

    protected $casts = ['input_snapshot' => 'array', 'report' => 'array', 'started_at' => 'datetime', 'completed_at' => 'datetime'];

    public function run()
    {
        return $this->belongsTo(Run::class);
    }
}
