<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->boolean('auto_created')
                ->default(false)
                ->after('status')
                ->index('idx_runs_auto_created');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->boolean('auto_created')
                ->default(false)
                ->after('auto_assign')
                ->index('idx_shipments_auto_created');
        });
    }

    public function down(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->dropIndex('idx_runs_auto_created');
            $table->dropColumn('auto_created');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropIndex('idx_shipments_auto_created');
            $table->dropColumn('auto_created');
        });
    }
};
