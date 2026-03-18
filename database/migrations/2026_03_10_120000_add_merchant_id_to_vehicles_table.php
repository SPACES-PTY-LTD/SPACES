<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('vehicles', 'merchant_id')) {
            Schema::table('vehicles', function (Blueprint $table) {
                $table->foreignId('merchant_id')
                    ->nullable()
                    ->after('account_id')
                    ->constrained('merchants')
                    ->nullOnDelete();
            });
        }

        DB::table('vehicles')
            ->select(['id', 'account_id', 'merchant_id'])
            ->whereNull('merchant_id')
            ->orderBy('id')
            ->chunkById(100, function ($vehicles): void {
                foreach ($vehicles as $vehicle) {
                    $merchantId = DB::table('runs')
                        ->where('vehicle_id', $vehicle->id)
                        ->whereNotNull('merchant_id')
                        ->orderByDesc('id')
                        ->value('merchant_id');

                    if (!$merchantId) {
                        $merchantId = DB::table('vehicle_activity')
                            ->where('vehicle_id', $vehicle->id)
                            ->whereNotNull('merchant_id')
                            ->orderByDesc('id')
                            ->value('merchant_id');
                    }

                    if (!$merchantId) {
                        $merchantId = DB::table('driver_vehicles')
                            ->join('drivers', 'drivers.id', '=', 'driver_vehicles.driver_id')
                            ->where('driver_vehicles.vehicle_id', $vehicle->id)
                            ->whereNotNull('drivers.merchant_id')
                            ->orderByDesc('driver_vehicles.id')
                            ->value('drivers.merchant_id');
                    }

                    if (!$merchantId && !empty($vehicle->account_id)) {
                        $merchantIds = DB::table('merchants')
                            ->where('account_id', $vehicle->account_id)
                            ->pluck('id');

                        if ($merchantIds->count() === 1) {
                            $merchantId = (int) $merchantIds->first();
                        }
                    }

                    if ($merchantId) {
                        DB::table('vehicles')
                            ->where('id', $vehicle->id)
                            ->update(['merchant_id' => $merchantId]);
                    }
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('vehicles', 'merchant_id')) {
            Schema::table('vehicles', function (Blueprint $table) {
                $table->dropForeign(['merchant_id']);
                $table->dropColumn('merchant_id');
            });
        }
    }
};
