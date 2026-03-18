<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (!Schema::hasColumn('bookings', 'collected_at')) {
                $table->timestamp('collected_at')->nullable()->after('booked_at');
            }

            if (!Schema::hasColumn('bookings', 'delivered_at')) {
                $table->timestamp('delivered_at')->nullable()->after('collected_at');
            }

            if (!Schema::hasColumn('bookings', 'returned_at')) {
                $table->timestamp('returned_at')->nullable()->after('delivered_at');
            }

            if (!Schema::hasColumn('bookings', 'odometer_at_request')) {
                $table->unsignedBigInteger('odometer_at_request')->nullable()->after('returned_at');
            }

            if (!Schema::hasColumn('bookings', 'odometer_at_collection')) {
                $table->unsignedBigInteger('odometer_at_collection')->nullable()->after('odometer_at_request');
            }

            if (!Schema::hasColumn('bookings', 'odometer_at_delivery')) {
                $table->unsignedBigInteger('odometer_at_delivery')->nullable()->after('odometer_at_collection');
            }

            if (!Schema::hasColumn('bookings', 'odometer_at_return')) {
                $table->unsignedBigInteger('odometer_at_return')->nullable()->after('odometer_at_delivery');
            }

            if (!Schema::hasColumn('bookings', 'total_km_from_collection')) {
                $table->decimal('total_km_from_collection', 10, 2)->nullable()->after('odometer_at_return');
            }
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            if (Schema::hasColumn('bookings', 'total_km_from_collection')) {
                $table->dropColumn('total_km_from_collection');
            }

            if (Schema::hasColumn('bookings', 'odometer_at_return')) {
                $table->dropColumn('odometer_at_return');
            }

            if (Schema::hasColumn('bookings', 'odometer_at_delivery')) {
                $table->dropColumn('odometer_at_delivery');
            }

            if (Schema::hasColumn('bookings', 'odometer_at_collection')) {
                $table->dropColumn('odometer_at_collection');
            }

            if (Schema::hasColumn('bookings', 'odometer_at_request')) {
                $table->dropColumn('odometer_at_request');
            }

            if (Schema::hasColumn('bookings', 'returned_at')) {
                $table->dropColumn('returned_at');
            }

            if (Schema::hasColumn('bookings', 'delivered_at')) {
                $table->dropColumn('delivered_at');
            }

            if (Schema::hasColumn('bookings', 'collected_at')) {
                $table->dropColumn('collected_at');
            }
        });
    }
};
