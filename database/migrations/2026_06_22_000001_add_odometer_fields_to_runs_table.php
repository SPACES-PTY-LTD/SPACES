<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            if (!Schema::hasColumn('runs', 'odometer_start_km')) {
                $table->unsignedBigInteger('odometer_start_km')->nullable()->after('completed_at');
            }

            if (!Schema::hasColumn('runs', 'odometer_end_km')) {
                $table->unsignedBigInteger('odometer_end_km')->nullable()->after('odometer_start_km');
            }
        });
    }

    public function down(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            if (Schema::hasColumn('runs', 'odometer_end_km')) {
                $table->dropColumn('odometer_end_km');
            }

            if (Schema::hasColumn('runs', 'odometer_start_km')) {
                $table->dropColumn('odometer_start_km');
            }
        });
    }
};
