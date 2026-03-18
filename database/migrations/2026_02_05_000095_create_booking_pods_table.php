<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_pods', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('booking_id')
                ->constrained('bookings')
                ->cascadeOnDelete()
                ->name('fk_booking_pods_booking')
                ->unique();
            $table->string('file_key');
            $table->string('file_type')->nullable();
            $table->string('signed_by')->nullable();
            $table->foreignId('captured_by_user_id')
                ->nullable()
                ->constrained('users')
                ->nullOnDelete()
                ->name('fk_booking_pods_captured_by')
                ->index();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_pods');
    }
};
