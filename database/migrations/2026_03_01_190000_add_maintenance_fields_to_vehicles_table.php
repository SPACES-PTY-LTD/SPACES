<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->timestamp('maintenance_mode_at')->nullable()->after('imported_at');
            $table->timestamp('maintenance_expected_resolved_at')->nullable()->after('maintenance_mode_at');
            $table->text('maintenance_description')->nullable()->after('maintenance_expected_resolved_at');
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropColumn([
                'maintenance_mode_at',
                'maintenance_expected_resolved_at',
                'maintenance_description',
            ]);
        });
    }
};
