<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class DataPurge extends Model
{
    use HasUuid;

    protected $guarded = ['id'];

    protected $casts = [
        'types' => 'array',
        'result' => 'array',
        'started_at' => 'datetime',
        'finished_at' => 'datetime',
    ];

    public function toStatus(): array
    {
        return [
            'job_id' => $this->uuid,
            'status' => $this->status,
            'progress' => $this->status === 'running' ? app(\App\Services\DataPurgeProgress::class)->read($this->uuid) : null,
            'requested_types' => $this->types,
            'created_at' => $this->created_at?->toIso8601String(),
            'started_at' => $this->started_at?->toIso8601String(),
            'finished_at' => $this->finished_at?->toIso8601String(),
            'result' => $this->result,
            'error_message' => $this->error_message,
        ];
    }
}
