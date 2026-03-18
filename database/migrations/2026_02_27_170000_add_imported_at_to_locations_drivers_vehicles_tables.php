<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'imported_at')) {
                $table->timestamp('imported_at')->nullable()->after('intergration_id');
            }
        });

        Schema::table('drivers', function (Blueprint $table) {
            if (!Schema::hasColumn('drivers', 'imported_at')) {
                $table->timestamp('imported_at')->nullable()->after('intergration_id');
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('vehicles', 'imported_at')) {
                $table->timestamp('imported_at')->nullable()->after('intergration_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'imported_at')) {
                $table->dropColumn('imported_at');
            }
        });

        Schema::table('drivers', function (Blueprint $table) {
            if (Schema::hasColumn('drivers', 'imported_at')) {
                $table->dropColumn('imported_at');
            }
        });

        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'imported_at')) {
                $table->dropColumn('imported_at');
            }
        });
    }
};
