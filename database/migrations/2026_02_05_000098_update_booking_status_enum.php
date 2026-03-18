<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE bookings MODIFY status ENUM('booked','pickup_scheduled','picked_up','in_transit','out_for_delivery','delivered','failed','cancelled') DEFAULT 'booked'");
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            return;
        }

        DB::statement("ALTER TABLE bookings MODIFY status ENUM('booked','cancelled','in_transit','delivered','failed') DEFAULT 'booked'");
    }
};
