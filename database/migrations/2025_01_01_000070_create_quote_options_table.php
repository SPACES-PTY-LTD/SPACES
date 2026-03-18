<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('quote_options', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('quote_id')
                ->constrained('quotes')
                ->cascadeOnDelete()
                ->name('fk_quote_options_quote')
                ->index();
            $table->string('carrier_code')->index();
            $table->string('service_code')->index();
            $table->string('currency')->default('ZAR');
            $table->decimal('amount', 12, 2);
            $table->decimal('tax_amount', 12, 2)->nullable();
            $table->decimal('total_amount', 12, 2);
            $table->timestamp('eta_from')->nullable();
            $table->timestamp('eta_to')->nullable();
            $table->json('rules')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('quote_options');
    }
};
