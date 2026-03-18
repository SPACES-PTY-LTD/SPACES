<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->foreignId('origin_location_id')
                ->nullable()
                ->after('vehicle_id')
                ->constrained('locations')
                ->nullOnDelete()
                ->name('fk_runs_origin_location')
                ->index();

            $table->foreignId('destination_location_id')
                ->nullable()
                ->after('origin_location_id')
                ->constrained('locations')
                ->nullOnDelete()
                ->name('fk_runs_destination_location')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->dropConstrainedForeignId('destination_location_id');
            $table->dropConstrainedForeignId('origin_location_id');
        });
    }
};
