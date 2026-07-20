<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class DeliveryNoteImport extends Model
{
    use HasAccountId, HasFactory, HasUuid;

    public const STATUS_ANALYZED = 'analyzed';

    public const STATUS_CONFIRMED = 'confirmed';

    public const STATUS_FAILED = 'failed';

    protected $fillable = [
        'uuid', 'account_id', 'merchant_id', 'environment_id', 'run_id',
        'uploaded_by_user_id', 'status', 'disk', 'path', 'original_name',
        'mime_type', 'size_bytes', 'model', 'extracted_data', 'failure_message',
        'confirmed_at',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'extracted_data' => 'array',
        'confirmed_at' => 'datetime',
    ];

    public function run(): BelongsTo
    {
        return $this->belongsTo(Run::class);
    }

    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class);
    }

    public function uploadedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by_user_id');
    }

    public function shipments(): BelongsToMany
    {
        return $this->belongsToMany(Shipment::class, 'delivery_note_import_shipments')->withTimestamps();
    }
}
