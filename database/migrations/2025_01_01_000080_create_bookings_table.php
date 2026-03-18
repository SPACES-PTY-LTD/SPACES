<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_bookings_merchant')
                ->index();
            $table->foreignId('shipment_id')
                ->constrained('shipments')
                ->cascadeOnDelete()
                ->name('fk_bookings_shipment')
                ->unique()
                ->index();
            $table->foreignId('quote_option_id')
                ->constrained('quote_options')
                ->cascadeOnDelete()
                ->name('fk_bookings_quote_option')
                ->index();
            $table->enum('status', ['booked', 'cancelled', 'in_transit', 'delivered', 'failed'])->default('booked')->index();
            $table->string('carrier_code')->index();
            $table->string('carrier_job_id')->nullable()->index();
            $table->text('label_url')->nullable();
            $table->timestamp('booked_at');
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason_code')->nullable();
            $table->text('cancellation_reason_note')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
