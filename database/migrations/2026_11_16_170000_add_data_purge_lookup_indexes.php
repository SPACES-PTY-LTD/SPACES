<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEXES = [
        'vehicle_activity' => [
            'va_purge_vehicle' => ['vehicle_id'],
            'va_purge_location' => ['location_id'],
        ],
        'vehicle_location_history' => [
            'vlh_purge_merchant_interval' => ['merchant_id', 'vehicle_id', 'observed_at', 'last_seen_at'],
        ],
        'vehicle_location_receipts' => [
            'vlr_vehicle_time' => ['vehicle_id', 'observed_at'],
        ],
    ];

    public function up(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($indexes) {
                foreach ($indexes as $name => $columns) {
                    $blueprint->index($columns, $name);
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::INDEXES as $table => $indexes) {
            Schema::table($table, function (Blueprint $blueprint) use ($indexes) {
                foreach ($indexes as $name => $columns) {
                    $blueprint->dropIndex($name);
                }
            });
        }
    }
};
