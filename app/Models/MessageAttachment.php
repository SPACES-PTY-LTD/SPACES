<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MessageAttachment extends Model
{
    use HasUuid, SoftDeletes;

    protected $fillable = ['uuid', 'account_id', 'merchant_id', 'message_id', 'type', 'path', 'url', 'filename', 'mime_type', 'size', 'meta'];

    protected $casts = ['meta' => 'array', 'size' => 'integer'];

    public function message()
    {
        return $this->belongsTo(Message::class);
    }
}
