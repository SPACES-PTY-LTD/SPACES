<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->index(
                ['merchant_id', 'vehicle_id', 'event_type', 'exited_at', 'entered_at'],
                'idx_vehicle_activity_open_visit'
            );
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->dropIndex('idx_vehicle_activity_open_visit');
        });
    }
};
