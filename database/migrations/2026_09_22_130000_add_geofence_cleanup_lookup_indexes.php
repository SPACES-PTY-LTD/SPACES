<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEXES = [
        'shipments' => ['shipments_geofence_audit' => ['merchant_id', 'auto_created', 'deleted_at', 'id']],
        'vehicle_activity' => [
            'va_cleanup_creation' => ['shipment_id', 'event_type', 'geofence_cleanup_batch_uuid', 'occurred_at'],
            'va_cleanup_run' => ['run_id', 'merchant_id', 'vehicle_id', 'event_type', 'occurred_at'],
        ],
        'activity_logs' => ['activity_logs_entity_lookup' => ['merchant_id', 'entity_type', 'entity_id', 'id']],
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
