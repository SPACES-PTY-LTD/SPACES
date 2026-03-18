<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('driver_assignments', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('booking_id')
                ->constrained('bookings')
                ->cascadeOnDelete()
                ->name('fk_driver_assignments_booking')
                ->index();
            $table->foreignId('driver_id')
                ->constrained('drivers')
                ->cascadeOnDelete()
                ->name('fk_driver_assignments_driver')
                ->index();
            $table->foreignId('assigned_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete()
                ->name('fk_driver_assignments_assigned_by')
                ->index();
            $table->timestamp('assigned_at')->useCurrent();
            $table->timestamp('unassigned_at')->nullable()->index();
            $table->text('notes')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_assignments');
    }
};
