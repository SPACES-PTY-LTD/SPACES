<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('geofence_cleanup_batches', function (Blueprint $table) {
            $table->uuid('uuid')->primary();
            $table->string('mode', 16);
            $table->uuid('audit_uuid')->nullable()->index();
            $table->unsignedBigInteger('merchant_id')->index();
            $table->json('scope');
            $table->string('status', 32);
            $table->timestamps();
        });
        Schema::create('geofence_cleanup_items', function (Blueprint $table) {
            $table->id();
            $table->uuid('batch_uuid')->index();
            $table->uuid('shipment_uuid');
            $table->string('classification', 32);
            $table->string('status', 32);
            $table->json('evidence');
            $table->string('fingerprint', 64)->nullable();
            $table->json('before_state')->nullable();
            $table->json('after_state')->nullable();
            $table->text('error')->nullable();
            $table->timestamps();
            $table->unique(['batch_uuid', 'shipment_uuid'], 'geofence_cleanup_item_unique');
        });
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->uuid('geofence_cleanup_batch_uuid')->nullable()->index();
        });
    }

    public function down(): void
    {
        if (\Illuminate\Support\Facades\DB::table('geofence_cleanup_items')->where('status', 'applied')->exists()) {
            throw new RuntimeException('Restore applied geofence cleanup batches before rolling back this migration.');
        }
        Schema::table('vehicle_activity', function (Blueprint $table) {
            $table->dropColumn('geofence_cleanup_batch_uuid');
        });
        Schema::dropIfExists('geofence_cleanup_items');
        Schema::dropIfExists('geofence_cleanup_batches');
    }
};
