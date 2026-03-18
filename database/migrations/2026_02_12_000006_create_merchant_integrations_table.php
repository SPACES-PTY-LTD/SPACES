<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_integrations', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->constrained('accounts')
                ->cascadeOnDelete()
                ->name('fk_merchant_integrations_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_merchant_integrations_merchant')
                ->index();
            $table->foreignId('provider_id')
                ->constrained('tracking_providers')
                ->cascadeOnDelete()
                ->name('fk_merchant_integrations_provider')
                ->index();
            $table->json('integration_data');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_integrations');
    }
};
