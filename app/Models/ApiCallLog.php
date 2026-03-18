<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApiCallLog extends Model
{
    protected $table = 'api_calls_logs';

    protected $fillable = [
        'request_id',
        'environment_id',
        'merchant_id',
        'account_id',
        'user_id',
        'source',
        'origin_url',
        'idempotency_key',
        'method',
        'path',
        'query',
        'status_code',
        'duration_ms',
        'ip',
        'user_agent',
        'response',
    ];

    protected $casts = [
        'query' => 'array',
    ];
}
