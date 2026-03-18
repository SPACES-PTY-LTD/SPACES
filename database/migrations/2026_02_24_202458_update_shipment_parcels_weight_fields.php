<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if (Schema::hasColumn('shipment_parcels', 'weight_kg')) {
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE shipment_parcels CHANGE weight_kg weight DECIMAL(10,3) NOT NULL');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE shipment_parcels RENAME COLUMN weight_kg TO weight');
            }
        }

        Schema::table('shipment_parcels', function (Blueprint $table) {
            if (!Schema::hasColumn('shipment_parcels', 'weight_measurement')) {
                $table->string('weight_measurement', 20)
                    ->default('kg')
                    ->after('weight');
            }

            if (!Schema::hasColumn('shipment_parcels', 'type')) {
                $table->string('type', 50)
                    ->nullable()
                    ->after('weight_measurement');
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipment_parcels', function (Blueprint $table) {
            if (Schema::hasColumn('shipment_parcels', 'type')) {
                $table->dropColumn('type');
            }

            if (Schema::hasColumn('shipment_parcels', 'weight_measurement')) {
                $table->dropColumn('weight_measurement');
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if (Schema::hasColumn('shipment_parcels', 'weight')) {
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE shipment_parcels CHANGE weight weight_kg DECIMAL(10,3) NOT NULL');
            } elseif ($driver === 'pgsql') {
                DB::statement('ALTER TABLE shipment_parcels RENAME COLUMN weight TO weight_kg');
            }
        }
    }
};
