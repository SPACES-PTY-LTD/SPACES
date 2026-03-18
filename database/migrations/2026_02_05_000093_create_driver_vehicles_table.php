<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_vehicles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')
                ->constrained('drivers')
                ->cascadeOnDelete()
                ->name('fk_driver_vehicles_driver')
                ->index();
            $table->foreignId('vehicle_id')
                ->constrained('vehicles')
                ->cascadeOnDelete()
                ->name('fk_driver_vehicles_vehicle')
                ->index();
            $table->unique(['driver_id', 'vehicle_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_vehicles');
    }
};
