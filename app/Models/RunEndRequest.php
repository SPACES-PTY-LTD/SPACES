<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class RunEndRequest extends Model
{
    use HasUuid;

    protected $guarded = ['id'];

    protected $casts = ['reviewed_at' => 'datetime'];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function toSummary(): array
    {
        return ['request_id' => $this->uuid, 'status' => $this->status, 'reason' => $this->reason,
            'requested_at' => $this->created_at?->toIso8601String(), 'requested_by' => $this->requester?->name,
            'reviewed_at' => $this->reviewed_at?->toIso8601String(), 'reviewed_by' => $this->reviewer?->name,
            'review_reason' => $this->review_reason];
    }
}
