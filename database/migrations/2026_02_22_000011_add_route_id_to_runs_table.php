<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->foreignId('route_id')
                ->nullable()
                ->after('destination_location_id')
                ->constrained('routes')
                ->nullOnDelete()
                ->name('fk_runs_route')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('route_id');
        });
    }
};
