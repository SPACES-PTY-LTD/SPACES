<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shipments', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_shipments_merchant')
                ->index();
            $table->string('merchant_order_ref')->index();
            $table->enum('status', ['draft', 'quoted', 'booked', 'cancelled', 'delivered', 'failed'])->default('draft')->index();
            $table->json('pickup_address');
            $table->json('dropoff_address');
            $table->text('pickup_instructions')->nullable();
            $table->text('dropoff_instructions')->nullable();
            $table->timestamp('ready_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'merchant_order_ref']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('shipments');
    }
};
