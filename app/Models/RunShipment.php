<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RunShipment extends Model
{
    use HasFactory, HasUuid;

    public const STATUS_PLANNED = 'planned';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_DONE = 'done';
    public const STATUS_FAILED = 'failed';
    public const STATUS_REMOVED = 'removed';

    protected $fillable = [
        'uuid',
        'run_id',
        'shipment_id',
        'sequence',
        'pickup_stop_order',
        'dropoff_stop_order',
        'status',
    ];

    protected static function booted(): void
    {
        static::saved(function (RunShipment $assignment) {
            $run = $assignment->run;
            if ($run?->schedule_managed) {
                $merchantId = $run->merchant_id;
                \Illuminate\Support\Facades\DB::afterCommit(fn () => app(\App\Services\RunReadinessService::class)->reconcile($merchantId));
            }
        });
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(Run::class);
    }

    public function shipment(): BelongsTo
    {
        return $this->belongsTo(Shipment::class);
    }
}
