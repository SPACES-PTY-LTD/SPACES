<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (!Schema::hasColumn('drivers', 'merchant_id')) {
                $table->foreignId('merchant_id')
                    ->nullable()
                    ->after('account_id')
                    ->constrained('merchants')
                    ->nullOnDelete()
                    ->name('fk_drivers_merchant')
                    ->index();
            }
        });

        $drivers = DB::table('drivers')
            ->select('drivers.id', 'carriers.merchant_id')
            ->leftJoin('carriers', 'carriers.id', '=', 'drivers.carrier_id')
            ->whereNull('drivers.merchant_id')
            ->orderBy('drivers.id')
            ->get();

        foreach ($drivers as $driver) {
            if (!$driver->merchant_id) {
                continue;
            }

            DB::table('drivers')
                ->where('id', $driver->id)
                ->update(['merchant_id' => $driver->merchant_id]);
        }
    }

    public function down(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            if (Schema::hasColumn('drivers', 'merchant_id')) {
                $table->dropForeign('fk_drivers_merchant');
                $table->dropColumn('merchant_id');
            }
        });
    }
};
