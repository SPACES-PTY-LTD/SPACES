<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE shipments MODIFY collection_date DATETIME NULL');
            DB::statement('ALTER TABLE quotes MODIFY collection_date DATETIME NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE shipments ALTER COLUMN collection_date TYPE timestamp USING collection_date::timestamp');
            DB::statement('ALTER TABLE quotes ALTER COLUMN collection_date TYPE timestamp USING collection_date::timestamp');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE shipments MODIFY collection_date DATE NULL');
            DB::statement('ALTER TABLE quotes MODIFY collection_date DATE NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE shipments ALTER COLUMN collection_date TYPE date USING collection_date::date');
            DB::statement('ALTER TABLE quotes ALTER COLUMN collection_date TYPE date USING collection_date::date');
        }
    }
};
