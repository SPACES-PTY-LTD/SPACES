<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_activity', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_vehicle_activity_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_vehicle_activity_merchant')
                ->index();
            $table->foreignId('vehicle_id')
                ->constrained('vehicles')
                ->cascadeOnDelete()
                ->name('fk_vehicle_activity_vehicle')
                ->index();
            $table->foreignId('location_id')
                ->nullable()
                ->constrained('locations')
                ->nullOnDelete()
                ->name('fk_vehicle_activity_location')
                ->index();
            $table->foreignId('run_id')
                ->nullable()
                ->constrained('runs')
                ->nullOnDelete()
                ->name('fk_vehicle_activity_run')
                ->index();
            $table->string('event_type', 32)->index();
            $table->timestamp('occurred_at')->index();
            $table->timestamp('entered_at')->nullable()->index();
            $table->timestamp('exited_at')->nullable()->index();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('speed_kph', 8, 2)->nullable();
            $table->decimal('speed_limit_kph', 8, 2)->nullable();
            $table->string('exit_reason', 32)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['merchant_id', 'vehicle_id', 'event_type', 'occurred_at'], 'idx_vehicle_activity_lookup');
            $table->index(['merchant_id', 'vehicle_id', 'location_id', 'entered_at'], 'idx_vehicle_activity_location_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_activity');
    }
};
