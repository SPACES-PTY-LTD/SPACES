<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicles', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('vehicle_type_id')
                ->nullable()
                ->constrained('vehicle_types')
                ->nullOnDelete()
                ->name('fk_vehicles_vehicle_type')
                ->index();
            $table->string('make')->nullable();
            $table->string('model')->nullable();
            $table->string('color')->nullable();
            $table->string('plate_number')->nullable();
            $table->string('vin_number')->nullable();
            $table->string('engine_number')->nullable();
            $table->string('ref_code')->nullable();
            $table->string('last_location_address')->nullable();
            $table->timestamp('location_updated_at')->nullable();
            $table->string('intergration_id')->nullable();
            $table->string('photo_key')->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicles');
    }
};
