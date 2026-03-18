<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_deliveries', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('webhook_subscription_id')
                ->constrained('webhook_subscriptions')
                ->cascadeOnDelete()
                ->name('fk_webhook_deliveries_subscription')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_webhook_deliveries_merchant')
                ->index();
            $table->string('event_type')->index();
            $table->json('payload');
            $table->enum('status', ['pending', 'attempted', 'delivered', 'failed'])->default('pending')->index();
            $table->unsignedInteger('attempts')->default(0);
            $table->timestamp('last_attempt_at')->nullable();
            $table->timestamp('next_attempt_at')->nullable()->index();
            $table->unsignedInteger('last_response_code')->nullable();
            $table->text('last_response_body')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_deliveries');
    }
};
