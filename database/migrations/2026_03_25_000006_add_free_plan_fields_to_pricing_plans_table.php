<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('pricing_plans')) {
            return;
        }

        Schema::table('pricing_plans', function (Blueprint $table) {
            if (!Schema::hasColumn('pricing_plans', 'is_free')) {
                $table->boolean('is_free')->default(false)->after('extra_vehicle_price_usd');
            }

            if (!Schema::hasColumn('pricing_plans', 'trial_days')) {
                $table->unsignedInteger('trial_days')->nullable()->after('is_free');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('pricing_plans')) {
            return;
        }

        Schema::table('pricing_plans', function (Blueprint $table) {
            if (Schema::hasColumn('pricing_plans', 'trial_days')) {
                $table->dropColumn('trial_days');
            }

            if (Schema::hasColumn('pricing_plans', 'is_free')) {
                $table->dropColumn('is_free');
            }
        });
    }
};
