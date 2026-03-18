<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_presences', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('driver_id')
                ->constrained('drivers')
                ->cascadeOnDelete()
                ->name('fk_driver_presences_driver')
                ->unique();
            $table->foreignId('user_device_id')
                ->nullable()
                ->constrained('user_devices')
                ->nullOnDelete()
                ->name('fk_driver_presences_user_device')
                ->index();
            $table->boolean('is_online')->default(false)->index();
            $table->boolean('is_available')->default(true)->index();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->timestamp('last_seen_at')->nullable()->index();
            $table->timestamp('last_offered_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_presences');
    }
};
