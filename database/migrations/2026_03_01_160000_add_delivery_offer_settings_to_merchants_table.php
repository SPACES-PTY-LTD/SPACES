<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (!Schema::hasColumn('merchants', 'support_email')) {
                $table->string('support_email')->nullable()->after('billing_email');
            }

            if (!Schema::hasColumn('merchants', 'max_driver_distance')) {
                $table->decimal('max_driver_distance', 8, 2)->nullable()->after('support_email');
            }

            if (!Schema::hasColumn('merchants', 'delivery_offers_expiry_time')) {
                $table->unsignedInteger('delivery_offers_expiry_time')->default(1)->after('max_driver_distance');
            }

            if (!Schema::hasColumn('merchants', 'driver_offline_timeout_minutes')) {
                $table->unsignedInteger('driver_offline_timeout_minutes')->default(120)->after('delivery_offers_expiry_time');
            }
        });
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            $columns = array_filter([
                Schema::hasColumn('merchants', 'support_email') ? 'support_email' : null,
                Schema::hasColumn('merchants', 'max_driver_distance') ? 'max_driver_distance' : null,
                Schema::hasColumn('merchants', 'delivery_offers_expiry_time') ? 'delivery_offers_expiry_time' : null,
                Schema::hasColumn('merchants', 'driver_offline_timeout_minutes') ? 'driver_offline_timeout_minutes' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
