<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('driver_vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('driver_vehicles', 'vehicle_id')) {
                $table->foreignId('vehicle_id')
                    ->nullable()
                    ->after('driver_id')
                    ->constrained('vehicles')
                    ->cascadeOnDelete()
                    ->name('fk_driver_vehicles_vehicle')
                    ->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('driver_vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('driver_vehicles', 'vehicle_id')) {
                $table->dropForeign('fk_driver_vehicles_vehicle');
                $table->dropColumn('vehicle_id');
            }
        });
    }
};
