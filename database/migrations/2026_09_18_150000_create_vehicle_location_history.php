<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_location_history', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('account_id');
            $table->unsignedBigInteger('merchant_id');
            $table->unsignedBigInteger('vehicle_id');
            $table->unsignedBigInteger('merchant_integration_id');
            $table->unsignedBigInteger('run_id')->nullable();
            $table->boolean('stationary');
            $table->boolean('delayed')->default(false);
            $table->boolean('source_time_known')->default(true);
            $table->dateTime('observed_at', 6);
            $table->dateTime('last_seen_at', 6);
            $table->dateTime('received_at', 6);
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('last_latitude', 10, 7);
            $table->decimal('last_longitude', 10, 7);
            $table->decimal('speed_kph', 9, 2)->nullable();
            $table->decimal('odometer_km', 14, 3)->nullable();
            $table->unsignedInteger('sample_count')->default(1);
            $table->string('first_sample_key', 64)->unique();
            $table->index(['vehicle_id', 'last_seen_at', 'id'], 'vlh_vehicle_latest');
            $table->index(['account_id', 'merchant_id', 'vehicle_id', 'observed_at'], 'vlh_vehicle_time');
            $table->index(['run_id', 'observed_at', 'id'], 'vlh_run_time');
        });
        Schema::table('runs', fn (Blueprint $table) => $table->index(['vehicle_id', 'started_at', 'completed_at'], 'runs_vehicle_actual_interval'));
        // Compact receipts preserve retry idempotency even after stop samples merge.
        Schema::create('vehicle_location_receipts', function (Blueprint $table) {
            $table->char('sample_key', 64)->primary();
            $table->unsignedBigInteger('vehicle_id');
            $table->dateTime('observed_at', 6);
        });
    }

    public function down(): void
    {
        Schema::table('runs', fn (Blueprint $table) => $table->dropIndex('runs_vehicle_actual_interval'));
        Schema::dropIfExists('vehicle_location_receipts');
        Schema::dropIfExists('vehicle_location_history');
    }
};
