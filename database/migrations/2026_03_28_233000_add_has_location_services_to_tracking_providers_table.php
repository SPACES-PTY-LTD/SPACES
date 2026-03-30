<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (!Schema::hasColumn('tracking_providers', 'has_location_services')) {
                $table->boolean('has_location_services')
                    ->default(false)
                    ->after('default_tracking');
            }
        });
    }

    public function down(): void
    {
        Schema::table('tracking_providers', function (Blueprint $table) {
            if (Schema::hasColumn('tracking_providers', 'has_location_services')) {
                $table->dropColumn('has_location_services');
            }
        });
    }
};
