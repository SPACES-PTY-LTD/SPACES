<?php

use App\Services\ParcelCodeService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->string('parcel_code', 12)->nullable()->after('shipment_id');
            $table->timestamp('picked_up_scanned_at')->nullable()->after('contents_description');
            $table->foreignId('picked_up_scanned_by_user_id')
                ->nullable()
                ->after('picked_up_scanned_at')
                ->constrained('users')
                ->nullOnDelete()
                ->name('fk_shipment_parcels_picked_up_scanned_by_user');
        });

        app(ParcelCodeService::class)->backfillMissingCodes();

        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->unique('parcel_code', 'uq_shipment_parcels_parcel_code');
            $table->index('picked_up_scanned_at', 'idx_shipment_parcels_picked_up_scanned_at');
        });
    }

    public function down(): void
    {
        Schema::table('shipment_parcels', function (Blueprint $table) {
            $table->dropIndex('idx_shipment_parcels_picked_up_scanned_at');
            $table->dropUnique('uq_shipment_parcels_parcel_code');
            $table->dropForeign('fk_shipment_parcels_picked_up_scanned_by_user');
            $table->dropColumn([
                'parcel_code',
                'picked_up_scanned_at',
                'picked_up_scanned_by_user_id',
            ]);
        });
    }
};
