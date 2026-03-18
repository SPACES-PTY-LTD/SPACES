<?php

namespace App\Models;

use App\Http\Traits\HasAccountId;
use App\Http\Traits\HasUuid;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class QuoteOption extends Model
{
    use HasFactory, SoftDeletes, HasUuid, HasAccountId;

    protected $fillable = [
        'uuid',
        'account_id',
        'quote_id',
        'carrier_code',
        'service_code',
        'currency',
        'amount',
        'tax_amount',
        'total_amount',
        'eta_from',
        'eta_to',
        'rules',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
        'eta_from' => 'datetime',
        'eta_to' => 'datetime',
        'rules' => 'array',
    ];

    public function quote()
    {
        return $this->belongsTo(Quote::class);
    }
}
