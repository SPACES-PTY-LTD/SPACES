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
            DB::statement('ALTER TABLE locations MODIFY address_line_1 VARCHAR(255) NULL');
            DB::statement('ALTER TABLE locations MODIFY city VARCHAR(255) NULL');
            DB::statement('ALTER TABLE locations MODIFY province VARCHAR(255) NULL');
            DB::statement('ALTER TABLE locations MODIFY post_code VARCHAR(255) NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement('ALTER TABLE locations ALTER COLUMN address_line_1 DROP NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN city DROP NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN province DROP NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN post_code DROP NOT NULL');
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("UPDATE locations SET address_line_1 = '' WHERE address_line_1 IS NULL");
            DB::statement("UPDATE locations SET city = 'Unknown' WHERE city IS NULL");
            DB::statement("UPDATE locations SET province = 'Unknown' WHERE province IS NULL");
            DB::statement("UPDATE locations SET post_code = '' WHERE post_code IS NULL");

            DB::statement('ALTER TABLE locations MODIFY address_line_1 VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE locations MODIFY city VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE locations MODIFY province VARCHAR(255) NOT NULL');
            DB::statement('ALTER TABLE locations MODIFY post_code VARCHAR(255) NOT NULL');
        } elseif ($driver === 'pgsql') {
            DB::statement("UPDATE locations SET address_line_1 = '' WHERE address_line_1 IS NULL");
            DB::statement("UPDATE locations SET city = 'Unknown' WHERE city IS NULL");
            DB::statement("UPDATE locations SET province = 'Unknown' WHERE province IS NULL");
            DB::statement("UPDATE locations SET post_code = '' WHERE post_code IS NULL");

            DB::statement('ALTER TABLE locations ALTER COLUMN address_line_1 SET NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN city SET NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN province SET NOT NULL');
            DB::statement('ALTER TABLE locations ALTER COLUMN post_code SET NOT NULL');
        }
    }
};
