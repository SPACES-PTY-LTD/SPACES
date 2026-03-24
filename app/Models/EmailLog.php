<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class EmailLog extends Model
{
    use HasUuid;

    public const STATUS_PENDING = 'pending';
    public const STATUS_SENT = 'sent';
    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'environment_id',
        'user_id',
        'related_type',
        'related_id',
        'status',
        'mailer',
        'mailable',
        'from_email',
        'from_name',
        'to',
        'cc',
        'bcc',
        'subject',
        'html_message',
        'message_id',
        'error_message',
        'sent_at',
        'failed_at',
    ];

    protected $casts = [
        'to' => 'array',
        'cc' => 'array',
        'bcc' => 'array',
        'sent_at' => 'datetime',
        'failed_at' => 'datetime',
    ];
}
