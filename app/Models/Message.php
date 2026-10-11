<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Message extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = ['uuid', 'account_id', 'merchant_id', 'conversation_id', 'user_id', 'type', 'temporary_id', 'body', 'read_at'];

    protected $casts = ['read_at' => 'datetime'];

    public function canBeDeletedBy(User $user): bool
    {
        return (int) $this->user_id === (int) $user->id && $this->temporary_id
            && !preg_match('/^(run-end-request:|run-end-review:)/', $this->temporary_id);
    }

    public function conversation()
    {
        return $this->belongsTo(Conversation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function attachments()
    {
        return $this->hasMany(MessageAttachment::class);
    }
}
