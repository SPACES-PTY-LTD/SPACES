<?php

namespace App\Models;

use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Conversation extends Model
{
    use HasUuid, SoftDeletes;

    protected $attributes = ['status' => 'active', 'is_private' => true];

    protected $fillable = ['uuid', 'account_id', 'merchant_id', 'type', 'type_entry_id', 'title', 'description', 'status', 'is_private'];

    protected $casts = ['is_private' => 'boolean'];

    public function merchant()
    {
        return $this->belongsTo(Merchant::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class, 'type_entry_id');
    }

    public function members()
    {
        return $this->hasMany(ConversationMember::class);
    }

    public function messages()
    {
        return $this->hasMany(Message::class);
    }

    public function latestMessage()
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }
}
