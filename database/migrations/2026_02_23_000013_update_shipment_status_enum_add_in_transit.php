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
            DB::statement("ALTER TABLE shipments MODIFY status ENUM('draft','quoted','booked','in_transit','cancelled','delivered','failed') DEFAULT 'draft'");
        }
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("UPDATE shipments SET status = 'booked' WHERE status = 'in_transit'");
            DB::statement("ALTER TABLE shipments MODIFY status ENUM('draft','quoted','booked','cancelled','delivered','failed') DEFAULT 'draft'");
        }
    }
};
