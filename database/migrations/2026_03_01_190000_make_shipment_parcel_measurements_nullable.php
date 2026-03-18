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

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE shipment_parcels MODIFY weight DECIMAL(10,3) NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY weight_measurement VARCHAR(20) NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY length_cm DECIMAL(10,2) NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY width_cm DECIMAL(10,2) NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY height_cm DECIMAL(10,2) NULL');

            return;
        }

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN weight DROP NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN weight_measurement DROP NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN length_cm DROP NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN width_cm DROP NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN height_cm DROP NOT NULL');

            return;
        }

        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->decimal('weight', 10, 3)->nullable()->change();
            $table->string('weight_measurement', 20)->nullable()->change();
            $table->decimal('length_cm', 10, 2)->nullable()->change();
            $table->decimal('width_cm', 10, 2)->nullable()->change();
            $table->decimal('height_cm', 10, 2)->nullable()->change();
        });
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("UPDATE shipment_parcels SET weight_measurement = 'kg' WHERE weight_measurement IS NULL");
            DB::statement('UPDATE shipment_parcels SET weight = 0.01 WHERE weight IS NULL');
            DB::statement('UPDATE shipment_parcels SET length_cm = 1 WHERE length_cm IS NULL');
            DB::statement('UPDATE shipment_parcels SET width_cm = 1 WHERE width_cm IS NULL');
            DB::statement('UPDATE shipment_parcels SET height_cm = 1 WHERE height_cm IS NULL');

            DB::statement("ALTER TABLE shipment_parcels MODIFY weight DECIMAL(10,3) NOT NULL");
            DB::statement("ALTER TABLE shipment_parcels MODIFY weight_measurement VARCHAR(20) NOT NULL DEFAULT 'kg'");
            DB::statement('ALTER TABLE shipment_parcels MODIFY length_cm DECIMAL(10,2) NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY width_cm DECIMAL(10,2) NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels MODIFY height_cm DECIMAL(10,2) NOT NULL');

            return;
        }

        if ($driver === 'pgsql') {
            DB::statement("UPDATE shipment_parcels SET weight_measurement = 'kg' WHERE weight_measurement IS NULL");
            DB::statement('UPDATE shipment_parcels SET weight = 0.01 WHERE weight IS NULL');
            DB::statement('UPDATE shipment_parcels SET length_cm = 1 WHERE length_cm IS NULL');
            DB::statement('UPDATE shipment_parcels SET width_cm = 1 WHERE width_cm IS NULL');
            DB::statement('UPDATE shipment_parcels SET height_cm = 1 WHERE height_cm IS NULL');

            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN weight SET NOT NULL');
            DB::statement("ALTER TABLE shipment_parcels ALTER COLUMN weight_measurement SET DEFAULT 'kg'");
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN weight_measurement SET NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN length_cm SET NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN width_cm SET NOT NULL');
            DB::statement('ALTER TABLE shipment_parcels ALTER COLUMN height_cm SET NOT NULL');

            return;
        }

        DB::table('shipment_parcels')->whereNull('weight_measurement')->update(['weight_measurement' => 'kg']);
        DB::table('shipment_parcels')->whereNull('weight')->update(['weight' => 0.01]);
        DB::table('shipment_parcels')->whereNull('length_cm')->update(['length_cm' => 1]);
        DB::table('shipment_parcels')->whereNull('width_cm')->update(['width_cm' => 1]);
        DB::table('shipment_parcels')->whereNull('height_cm')->update(['height_cm' => 1]);

        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->decimal('weight', 10, 3)->nullable(false)->change();
            $table->string('weight_measurement', 20)->default('kg')->nullable(false)->change();
            $table->decimal('length_cm', 10, 2)->nullable(false)->change();
            $table->decimal('width_cm', 10, 2)->nullable(false)->change();
            $table->decimal('height_cm', 10, 2)->nullable(false)->change();
        });
    }
};
