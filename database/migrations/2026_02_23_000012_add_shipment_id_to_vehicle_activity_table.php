<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->foreignId('shipment_id')
                ->nullable()
                ->after('run_id')
                ->constrained('shipments')
                ->nullOnDelete()
                ->name('fk_vehicle_activity_shipment')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->dropConstrainedForeignId('shipment_id');
        });
    }
};
