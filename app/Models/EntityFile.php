<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class EntityFile extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'merchant_id',
        'file_type_id',
        'attachable_type',
        'attachable_id',
        'uploaded_by_user_id',
        'uploaded_by_role',
        'disk',
        'path',
        'original_name',
        'mime_type',
        'size_bytes',
        'expires_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'expires_at' => 'datetime',
    ];

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function fileType(): BelongsTo
    {
        return $this->belongsTo(FileType::class);
    }

    public function attachable(): MorphTo
    {
        return $this->morphTo();
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }
}
