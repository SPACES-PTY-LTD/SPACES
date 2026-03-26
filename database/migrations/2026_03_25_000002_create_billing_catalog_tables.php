<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('payment_gateways')) {
            Schema::create('payment_gateways', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->unique();
                $table->string('code')->unique();
                $table->string('name');
                $table->string('type')->default('card');
                $table->boolean('is_active')->default(true);
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('country_pricing')) {
            Schema::create('country_pricing', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->unique();
                $table->string('country_name');
                $table->string('country_code', 2)->unique();
                $table->string('currency', 3);
                $table->unsignedBigInteger('payment_gateway_id');
                $table->index('payment_gateway_id', 'country_pricing_payment_gateway_idx');
                $table->foreign('payment_gateway_id', 'country_pricing_payment_gateway_fk')
                    ->references('id')
                    ->on('payment_gateways')
                    ->cascadeOnDelete();
                $table->boolean('is_default')->default(false)->index();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('pricing_plans')) {
            Schema::create('pricing_plans', function (Blueprint $table) {
                $table->id();
                $table->string('uuid', 36)->unique();
                $table->string('title');
                $table->unsignedInteger('vehicle_limit')->default(0);
                $table->decimal('monthly_charge_zar', 12, 2)->default(0);
                $table->decimal('monthly_charge_usd', 12, 2)->default(0);
                $table->decimal('extra_vehicle_price_zar', 12, 2)->default(0);
                $table->decimal('extra_vehicle_price_usd', 12, 2)->default(0);
                $table->boolean('is_active')->default(true)->index();
                $table->integer('sort_order')->default(0);
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pricing_plans');
        Schema::dropIfExists('country_pricing');
        Schema::dropIfExists('payment_gateways');
    }
};
