<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('vehicles', 'vin_number')) {
                $table->string('vin_number')->nullable()->after('plate_number');
            }
            if (!Schema::hasColumn('vehicles', 'engine_number')) {
                $table->string('engine_number')->nullable()->after('vin_number');
            }
            if (!Schema::hasColumn('vehicles', 'ref_code')) {
                $table->string('ref_code')->nullable()->after('engine_number');
            }
            if (!Schema::hasColumn('vehicles', 'last_location_address')) {
                $table->string('last_location_address')->nullable()->after('ref_code');
            }
            if (!Schema::hasColumn('vehicles', 'location_updated_at')) {
                $table->timestamp('location_updated_at')->nullable()->after('last_location_address');
            }
            if (!Schema::hasColumn('vehicles', 'intergration_id')) {
                $table->string('intergration_id')->nullable()->after('location_updated_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'intergration_id')) {
                $table->dropColumn('intergration_id');
            }
            if (Schema::hasColumn('vehicles', 'location_updated_at')) {
                $table->dropColumn('location_updated_at');
            }
            if (Schema::hasColumn('vehicles', 'last_location_address')) {
                $table->dropColumn('last_location_address');
            }
            if (Schema::hasColumn('vehicles', 'ref_code')) {
                $table->dropColumn('ref_code');
            }
            if (Schema::hasColumn('vehicles', 'engine_number')) {
                $table->dropColumn('engine_number');
            }
            if (Schema::hasColumn('vehicles', 'vin_number')) {
                $table->dropColumn('vin_number');
            }
        });
    }
};
