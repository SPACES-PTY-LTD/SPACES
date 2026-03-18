<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('runs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_runs_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_runs_merchant')
                ->index();
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_runs_environment')
                ->index();
            $table->foreignId('driver_id')
                ->nullable()
                ->constrained('drivers')
                ->nullOnDelete()
                ->name('fk_runs_driver')
                ->index();
            $table->foreignId('vehicle_id')
                ->nullable()
                ->constrained('vehicles')
                ->nullOnDelete()
                ->name('fk_runs_vehicle')
                ->index();
            $table->enum('status', ['draft', 'dispatched', 'in_progress', 'completed', 'cancelled'])
                ->default('draft')
                ->index();
            $table->timestamp('planned_start_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('service_area')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('runs');
    }
};
