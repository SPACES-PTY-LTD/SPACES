<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('accounts', function (Blueprint $table) {
            if (!Schema::hasColumn('accounts', 'country_code')) {
                $table->string('country_code', 2)->default('US')->after('owner_user_id');
            }
            if (!Schema::hasColumn('accounts', 'is_billing_exempt')) {
                $table->boolean('is_billing_exempt')->default(false)->after('country_code');
            }
        });

        if (!Schema::hasColumn('merchants', 'plan_id')) {
            Schema::table('merchants', function (Blueprint $table) {
                $table->unsignedBigInteger('plan_id')->nullable()->after('account_id');
                $table->index('plan_id', 'merchants_plan_idx');
                $table->foreign('plan_id', 'fk_merchants_plan')
                    ->references('id')
                    ->on('pricing_plans')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $table->dropForeign('fk_merchants_plan');
            $table->dropColumn('plan_id');
        });

        Schema::table('accounts', function (Blueprint $table) {
            $table->dropColumn(['country_code', 'is_billing_exempt']);
        });
    }
};
