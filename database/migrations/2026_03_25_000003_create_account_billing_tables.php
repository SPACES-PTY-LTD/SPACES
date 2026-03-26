<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('account_billing_profiles')) {
            Schema::create('account_billing_profiles', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->unsignedBigInteger('account_id')->unique();
            $table->foreign('account_id', 'account_billing_profiles_account_fk')->references('id')->on('accounts')->cascadeOnDelete();
            $table->unsignedBigInteger('payment_gateway_id')->nullable();
            $table->foreign('payment_gateway_id', 'account_billing_profiles_gateway_fk')->references('id')->on('payment_gateways')->nullOnDelete();
            $table->string('gateway_code')->nullable()->index();
            $table->string('gateway_customer_id')->nullable();
            $table->string('gateway_reference')->nullable();
            $table->json('gateway_metadata')->nullable();
            $table->timestamp('last_synced_at')->nullable();
            $table->timestamps();
            });
        }

        if (!Schema::hasTable('account_payment_methods')) {
            Schema::create('account_payment_methods', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->unsignedBigInteger('account_id');
            $table->index('account_id', 'account_payment_methods_account_idx');
            $table->foreign('account_id', 'account_payment_methods_account_fk')->references('id')->on('accounts')->cascadeOnDelete();
            $table->unsignedBigInteger('billing_profile_id')->nullable();
            $table->foreign('billing_profile_id', 'account_payment_methods_profile_fk')->references('id')->on('account_billing_profiles')->nullOnDelete();
            $table->unsignedBigInteger('payment_gateway_id')->nullable();
            $table->foreign('payment_gateway_id', 'account_payment_methods_gateway_fk')->references('id')->on('payment_gateways')->nullOnDelete();
            $table->string('gateway_code')->nullable()->index();
            $table->string('gateway_customer_id')->nullable();
            $table->string('gateway_payment_method_id')->nullable();
            $table->string('gateway_reference')->nullable();
            $table->string('brand')->nullable();
            $table->string('last_four', 4)->nullable();
            $table->unsignedTinyInteger('expiry_month')->nullable();
            $table->unsignedSmallInteger('expiry_year')->nullable();
            $table->boolean('is_default')->default(false);
            $table->string('status')->default('active')->index();
            $table->timestamp('verified_at')->nullable();
            $table->json('gateway_metadata')->nullable();
            $table->timestamps();
            });
        }

        if (!Schema::hasTable('account_invoices')) {
            Schema::create('account_invoices', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->unsignedBigInteger('account_id');
            $table->index('account_id', 'account_invoices_account_idx');
            $table->foreign('account_id', 'account_invoices_account_fk')->references('id')->on('accounts')->cascadeOnDelete();
            $table->string('invoice_number')->unique();
            $table->date('billing_period_start');
            $table->date('billing_period_end');
            $table->string('currency', 3);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('total', 12, 2)->default(0);
            $table->string('invoice_status')->default('draft')->index();
            $table->string('payment_status')->default('unpaid')->index();
            $table->string('gateway_code')->nullable()->index();
            $table->date('due_date')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->timestamp('last_payment_attempt_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['account_id', 'billing_period_start', 'billing_period_end'], 'account_invoice_period_unique');
            });
        }

        if (!Schema::hasTable('account_invoice_lines')) {
            Schema::create('account_invoice_lines', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->unsignedBigInteger('account_invoice_id');
            $table->index('account_invoice_id', 'account_invoice_lines_invoice_idx');
            $table->foreign('account_invoice_id', 'account_invoice_lines_invoice_fk')->references('id')->on('account_invoices')->cascadeOnDelete();
            $table->unsignedBigInteger('merchant_id')->nullable();
            $table->index('merchant_id', 'account_invoice_lines_merchant_idx');
            $table->foreign('merchant_id', 'account_invoice_lines_merchant_fk')->references('id')->on('merchants')->nullOnDelete();
            $table->unsignedBigInteger('plan_id')->nullable();
            $table->foreign('plan_id', 'account_invoice_lines_plan_fk')->references('id')->on('pricing_plans')->nullOnDelete();
            $table->string('type')->index();
            $table->string('description');
            $table->unsignedInteger('quantity')->default(1);
            $table->decimal('unit_amount', 12, 2)->default(0);
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->unsignedInteger('included_vehicles')->default(0);
            $table->unsignedInteger('billable_vehicles')->default(0);
            $table->json('snapshot')->nullable();
            $table->timestamps();
            });
        }

        if (!Schema::hasTable('account_invoice_payment_attempts')) {
            Schema::create('account_invoice_payment_attempts', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->unsignedBigInteger('account_invoice_id');
            $table->index('account_invoice_id', 'account_invoice_payment_attempts_invoice_idx');
            $table->foreign('account_invoice_id', 'account_invoice_payment_attempts_invoice_fk')->references('id')->on('account_invoices')->cascadeOnDelete();
            $table->unsignedBigInteger('account_id');
            $table->index('account_id', 'account_invoice_payment_attempts_account_idx');
            $table->foreign('account_id', 'account_invoice_payment_attempts_account_fk')->references('id')->on('accounts')->cascadeOnDelete();
            $table->unsignedBigInteger('payment_gateway_id')->nullable();
            $table->foreign('payment_gateway_id', 'account_invoice_payment_attempts_gateway_fk')->references('id')->on('payment_gateways')->nullOnDelete();
            $table->unsignedBigInteger('payment_method_id')->nullable();
            $table->foreign('payment_method_id', 'account_invoice_payment_attempts_method_fk')->references('id')->on('account_payment_methods')->nullOnDelete();
            $table->string('gateway_code')->nullable()->index();
            $table->string('status')->default('pending')->index();
            $table->string('provider_transaction_id')->nullable();
            $table->string('provider_reference')->nullable();
            $table->decimal('amount', 12, 2)->default(0);
            $table->json('request_payload')->nullable();
            $table->json('response_payload')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('account_invoice_payment_attempts');
        Schema::dropIfExists('account_invoice_lines');
        Schema::dropIfExists('account_invoices');
        Schema::dropIfExists('account_payment_methods');
        Schema::dropIfExists('account_billing_profiles');
    }
};
