<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('vehicles', 'last_location_address')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("UPDATE vehicles SET last_location_address = JSON_OBJECT('address_line_1', last_location_address) WHERE last_location_address IS NOT NULL AND last_location_address != '' AND JSON_VALID(last_location_address) = 0");
            DB::statement('ALTER TABLE vehicles MODIFY last_location_address JSON NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE vehicles ALTER COLUMN last_location_address TYPE jsonb USING NULLIF(last_location_address, \'\')::jsonb');
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('vehicles', 'last_location_address')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement('ALTER TABLE vehicles MODIFY last_location_address VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE vehicles ALTER COLUMN last_location_address TYPE varchar(255)');
        }
    }
};
