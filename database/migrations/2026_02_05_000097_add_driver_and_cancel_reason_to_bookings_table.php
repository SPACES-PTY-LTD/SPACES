<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('current_driver_id')
                ->nullable()
                ->after('quote_option_id')
                ->constrained('drivers')
                ->nullOnDelete()
                ->name('fk_bookings_current_driver')
                ->index();
            $table->text('cancel_reason')->nullable()->after('cancellation_reason_note');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign('fk_bookings_current_driver');
            $table->dropColumn(['current_driver_id', 'cancel_reason']);
        });
    }
};
