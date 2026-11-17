<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEXES = [
        'vehicle_location_history' => [
            'vlh_purge_merchant_id' => ['merchant_id', 'id'],
            'vlh_vehicle_merchant' => ['vehicle_id', 'merchant_id'],
        ],
        'vehicle_location_receipts' => [
            'vlr_merchant' => ['merchant_id'],
            'vlr_history' => ['vehicle_location_history_id'],
        ],
    ];

    public function up(): void
    {
        // No inference/backfill during deployment: ambiguous legacy receipts
        // remain NULL and use the conservative purge path.
        foreach (['merchant_id', 'vehicle_location_history_id'] as $column) {
            if (! Schema::hasColumn('vehicle_location_receipts', $column)) {
                Schema::table('vehicle_location_receipts', fn (Blueprint $table) => $table->unsignedBigInteger($column)->nullable());
            }
        }
        foreach (self::INDEXES as $table => $indexes) {
            foreach ($indexes as $name => $columns) {
                if (! Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $blueprint) => $blueprint->index($columns, $name));
                }
            }
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            foreach ($indexes as $name => $columns) {
                if (Schema::hasIndex($table, $name)) {
                    Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropIndex($name));
                }
            }
        }
        foreach (['merchant_id', 'vehicle_location_history_id'] as $column) {
            if (Schema::hasColumn('vehicle_location_receipts', $column)) {
                Schema::table('vehicle_location_receipts', fn (Blueprint $table) => $table->dropColumn($column));
            }
        }
    }
};
