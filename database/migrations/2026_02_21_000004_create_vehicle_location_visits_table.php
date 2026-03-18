<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_location_visits', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_vehicle_location_visits_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_vehicle_location_visits_merchant')
                ->index();
            $table->foreignId('vehicle_id')
                ->constrained('vehicles')
                ->cascadeOnDelete()
                ->name('fk_vehicle_location_visits_vehicle')
                ->index();
            $table->foreignId('location_id')
                ->constrained('locations')
                ->cascadeOnDelete()
                ->name('fk_vehicle_location_visits_location')
                ->index();
            $table->foreignId('run_id')
                ->nullable()
                ->constrained('runs')
                ->nullOnDelete()
                ->name('fk_vehicle_location_visits_run')
                ->index();
            $table->timestamp('entered_at')->index();
            $table->timestamp('exited_at')->nullable()->index();
            $table->decimal('enter_latitude', 10, 7)->nullable();
            $table->decimal('enter_longitude', 10, 7)->nullable();
            $table->decimal('exit_latitude', 10, 7)->nullable();
            $table->decimal('exit_longitude', 10, 7)->nullable();
            $table->string('exit_reason', 32)->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'vehicle_id', 'exited_at'], 'idx_vehicle_location_visits_open_lookup');
            $table->index(['merchant_id', 'vehicle_id', 'location_id'], 'idx_vehicle_location_visits_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_location_visits');
    }
};
