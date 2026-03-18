<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->unsignedBigInteger('last_driver_id')->nullable()->after('location_updated_at');
            $table->timestamp('driver_logged_at')->nullable()->after('last_driver_id');

            $table->foreign('last_driver_id')
                ->references('id')
                ->on('drivers')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            $table->dropForeign(['last_driver_id']);
            $table->dropColumn(['last_driver_id', 'driver_logged_at']);
        });
    }
};
