<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

class ActivityLog extends Model
{
    use HasFactory, HasUuid, Prunable;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'actor_user_id',
        'action',
        'entity_type',
        'entity_id',
        'entity_uuid',
        'title',
        'changes',
        'metadata',
        'request_id',
        'ip_address',
        'user_agent',
        'occurred_at',
    ];

    protected $casts = [
        'changes' => 'array',
        'metadata' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function environment()
    {
        return $this->belongsTo(MerchantEnvironment::class);
    }

    public function actor()
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }

    public function prunable(): Builder
    {
        return static::query()->where('occurred_at', '<', now()->subMonths(6));
    }
}
