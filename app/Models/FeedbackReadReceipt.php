<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FeedbackReadReceipt extends Model
{
    protected $fillable = ['feedback_id', 'user_id', 'last_read_message_id', 'last_read_at'];

    protected $casts = ['last_read_at' => 'datetime'];

    public function feedback()
    {
        return $this->belongsTo(Feedback::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
