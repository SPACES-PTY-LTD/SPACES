<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const SHIPMENT_STATUSES = ['draft', 'quoted', 'booked', 'in_transit', 'cancelled', 'delivered', 'failed', 'offer_failed'];

    private const BOOKING_STATUSES = ['booked', 'pickup_scheduled', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'cancelled'];

    public function up(): void
    {
        $this->changeStatuses(true);
    }

    public function down(): void
    {
        foreach (['shipments', 'bookings'] as $table) {
            DB::table($table)->where('status', 'at_delivery_location')->update(['status' => 'in_transit']);
        }
        $this->changeStatuses(false);
    }

    private function changeStatuses(bool $includeArrival): void
    {
        foreach (['shipments' => self::SHIPMENT_STATUSES, 'bookings' => self::BOOKING_STATUSES] as $name => $statuses) {
            if ($includeArrival) {
                $statuses[] = 'at_delivery_location';
            }
            Schema::table($name, function (Blueprint $table) use ($statuses, $name) {
                $table->enum('status', $statuses)->default($name === 'shipments' ? 'draft' : 'booked')->change();
            });
        }
    }
};
