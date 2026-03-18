<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('shipments', 'requested_vehicle_type_id')) {
                $table->foreignId('requested_vehicle_type_id')
                    ->nullable()
                    ->after('dropoff_location_id')
                    ->constrained('vehicle_types')
                    ->nullOnDelete()
                    ->name('fk_shipments_requested_vehicle_type')
                    ->index();
            }
        });

        if ($this->supportsAlterEnum()) {
            DB::statement("ALTER TABLE shipments MODIFY status ENUM('draft','quoted','booked','in_transit','cancelled','delivered','failed','offer_failed') DEFAULT 'draft'");
        }
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'requested_vehicle_type_id')) {
                $table->dropForeign('fk_shipments_requested_vehicle_type');
                $table->dropColumn('requested_vehicle_type_id');
            }
        });

        if ($this->supportsAlterEnum()) {
            DB::statement("UPDATE shipments SET status = 'draft' WHERE status = 'offer_failed'");
            DB::statement("ALTER TABLE shipments MODIFY status ENUM('draft','quoted','booked','in_transit','cancelled','delivered','failed') DEFAULT 'draft'");
        }
    }

    private function supportsAlterEnum(): bool
    {
        return DB::getDriverName() !== 'sqlite';
    }
};
