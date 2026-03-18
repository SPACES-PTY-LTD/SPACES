<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('vehicles', 'odometer')) {
                $table->unsignedBigInteger('odometer')->nullable()->after('ref_code');
            }

            if (!Schema::hasColumn('vehicles', 'year')) {
                $table->unsignedSmallInteger('year')->nullable()->after('odometer');
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'year')) {
                $table->dropColumn('year');
            }

            if (Schema::hasColumn('vehicles', 'odometer')) {
                $table->dropColumn('odometer');
            }
        });
    }
};
