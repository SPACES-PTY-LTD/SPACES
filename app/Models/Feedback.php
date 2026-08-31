<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Feedback extends Model
{
    use HasFactory, HasUuid, SoftDeletes;

    public const CATEGORIES = ['bug', 'feature_request', 'general'];

    public const STATUSES = ['open', 'in_progress', 'needs_info', 'resolved', 'closed'];

    protected $table = 'feedback';

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'submitted_by_user_id',
        'assigned_to_user_id',
        'status_updated_by_user_id',
        'category',
        'status',
        'page_path',
        'user_agent',
        'status_updated_at',
    ];

    protected $casts = [
        'status_updated_at' => 'datetime',
    ];

    public function account()
    {
        return $this->belongsTo(Account::class);
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by_user_id');
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to_user_id');
    }

    public function statusUpdatedBy()
    {
        return $this->belongsTo(User::class, 'status_updated_by_user_id');
    }

    public function messages()
    {
        return $this->hasMany(FeedbackMessage::class)->orderBy('created_at')->orderBy('id');
    }

    public function latestMessage()
    {
        return $this->hasOne(FeedbackMessage::class)->latestOfMany();
    }

    public function readReceipts()
    {
        return $this->hasMany(FeedbackReadReceipt::class);
    }
}
