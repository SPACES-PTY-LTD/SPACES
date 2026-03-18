<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('run_shipments', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('run_id')
                ->constrained('runs')
                ->cascadeOnDelete()
                ->name('fk_run_shipments_run')
                ->index();
            $table->foreignId('shipment_id')
                ->constrained('shipments')
                ->cascadeOnDelete()
                ->name('fk_run_shipments_shipment')
                ->index();
            $table->unsignedInteger('sequence')->nullable();
            $table->unsignedInteger('pickup_stop_order')->nullable();
            $table->unsignedInteger('dropoff_stop_order')->nullable();
            $table->enum('status', ['planned', 'active', 'done', 'failed', 'removed'])
                ->default('planned')
                ->index();
            $table->timestamps();

            $table->unique(['run_id', 'shipment_id'], 'uq_run_shipments_run_shipment');
            $table->index(['run_id', 'status'], 'idx_run_shipments_run_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('run_shipments');
    }
};
