<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quotes', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_quotes_merchant')
                ->index();
            $table->foreignId('shipment_id')
                ->constrained('shipments')
                ->cascadeOnDelete()
                ->name('fk_quotes_shipment')
                ->index();
            $table->enum('status', ['created', 'expired'])->default('created')->index();
            $table->timestamp('requested_at');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quotes');
    }
};
