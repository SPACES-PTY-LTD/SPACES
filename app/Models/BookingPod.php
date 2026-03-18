<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BookingPod extends Model
{
    use HasFactory, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'booking_id',
        'file_key',
        'file_type',
        'signed_by',
        'captured_by_user_id',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function booking()
    {
        return $this->belongsTo(Booking::class);
    }

    public function capturedBy()
    {
        return $this->belongsTo(User::class, 'captured_by_user_id');
    }
}
