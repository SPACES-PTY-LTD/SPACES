<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('pickup_location_id')
                ->nullable()
                ->after('status')
                ->constrained('locations')
                ->name('fk_shipments_pickup_location')
                ->index();
            $table->foreignId('dropoff_location_id')
                ->nullable()
                ->after('pickup_location_id')
                ->constrained('locations')
                ->name('fk_shipments_dropoff_location')
                ->index();

            $table->dropColumn(['pickup_address', 'dropoff_address']);
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->json('pickup_address')->after('status');
            $table->json('dropoff_address')->after('pickup_address');

            $table->dropForeign('fk_shipments_pickup_location');
            $table->dropForeign('fk_shipments_dropoff_location');
            $table->dropColumn(['pickup_location_id', 'dropoff_location_id']);
        });
    }
};
