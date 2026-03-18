<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_offers', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_delivery_offers_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_delivery_offers_merchant')
                ->index();
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_delivery_offers_environment')
                ->index();
            $table->foreignId('shipment_id')
                ->constrained('shipments')
                ->cascadeOnDelete()
                ->name('fk_delivery_offers_shipment')
                ->index();
            $table->foreignId('driver_id')
                ->constrained('drivers')
                ->cascadeOnDelete()
                ->name('fk_delivery_offers_driver')
                ->index();
            $table->foreignId('user_device_id')
                ->nullable()
                ->constrained('user_devices')
                ->nullOnDelete()
                ->name('fk_delivery_offers_user_device')
                ->index();
            $table->enum('status', ['pending', 'accepted', 'declined', 'expired', 'cancelled'])->default('pending')->index();
            $table->unsignedInteger('sequence')->default(1);
            $table->timestamp('offered_at');
            $table->timestamp('expires_at');
            $table->timestamp('responded_at')->nullable();
            $table->string('response_reason')->nullable();
            $table->json('notification_payload')->nullable();
            $table->timestamps();

            $table->index(['driver_id', 'status'], 'idx_delivery_offers_driver_status');
            $table->index(['shipment_id', 'status'], 'idx_delivery_offers_shipment_status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_offers');
    }
};
