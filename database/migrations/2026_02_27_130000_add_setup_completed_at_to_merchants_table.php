<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (!Schema::hasColumn('merchants', 'setup_completed_at')) {
                $table->timestamp('setup_completed_at')
                    ->nullable()
                    ->after('allow_auto_shipment_creations_at_locations');
            }
        });
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (Schema::hasColumn('merchants', 'setup_completed_at')) {
                $table->dropColumn('setup_completed_at');
            }
        });
    }
};
