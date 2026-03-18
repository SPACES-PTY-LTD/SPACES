<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (!Schema::hasColumn('tracking_providers', 'supports_bulk_vehicle_requests')) {
                $table->boolean('supports_bulk_vehicle_requests')
                    ->default(false)
                    ->after('documentation');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_providers', 'supports_bulk_vehicle_requests')) {
                $table->dropColumn('supports_bulk_vehicle_requests');
            }
        });
    }
};
