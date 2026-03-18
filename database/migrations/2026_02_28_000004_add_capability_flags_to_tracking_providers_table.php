<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (!Schema::hasColumn('tracking_providers', 'default_tracking')) {
                $table->boolean('default_tracking')
                    ->default(false)
                    ->after('supports_bulk_vehicle_requests');
            }

            if (!Schema::hasColumn('tracking_providers', 'has_driver_importing')) {
                $table->boolean('has_driver_importing')
                    ->default(false)
                    ->after('default_tracking');
            }

            if (!Schema::hasColumn('tracking_providers', 'has_locations_importing')) {
                $table->boolean('has_locations_importing')
                    ->default(false)
                    ->after('has_driver_importing');
            }

            if (!Schema::hasColumn('tracking_providers', 'has_vehicle_importing')) {
                $table->boolean('has_vehicle_importing')
                    ->default(false)
                    ->after('has_locations_importing');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_providers', 'default_tracking')) {
                $table->dropColumn('default_tracking');
            }

            if (Schema::hasColumn('tracking_providers', 'has_driver_importing')) {
                $table->dropColumn('has_driver_importing');
            }

            if (Schema::hasColumn('tracking_providers', 'has_locations_importing')) {
                $table->dropColumn('has_locations_importing');
            }

            if (Schema::hasColumn('tracking_providers', 'has_vehicle_importing')) {
                $table->dropColumn('has_vehicle_importing');
            }
        });
    }
};
