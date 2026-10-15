<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->index(['merchant_id', 'vehicle_id', 'geofence_cleanup_batch_uuid', 'occurred_at', 'id'], 'va_monitoring_latest');
            $table->index(['merchant_id', 'vehicle_id', 'event_type', 'geofence_cleanup_batch_uuid', 'occurred_at', 'id'], 'va_monitoring_transition');
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->dropIndex('va_monitoring_latest');
            $table->dropIndex('va_monitoring_transition');
        });
    }
};
