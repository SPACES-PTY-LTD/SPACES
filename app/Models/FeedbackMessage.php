<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;

class FeedbackMessage extends Model
{
    use HasUuid;

    protected $fillable = [
        'uuid',
        'feedback_id',
        'sender_user_id',
        'author_type',
        'body',
    ];

    public function feedback()
    {
        return $this->belongsTo(Feedback::class);
    }

    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_user_id');
    }
}
