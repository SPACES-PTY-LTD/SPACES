<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_shipments_environment')
                ->after('merchant_id')
                ->index();
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_quotes_environment')
                ->after('merchant_id')
                ->index();
        });

        Schema::table('bookings', function (Blueprint $table) {
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_bookings_environment')
                ->after('merchant_id')
                ->index();
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropForeign('fk_bookings_environment');
            $table->dropColumn('environment_id');
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->dropForeign('fk_quotes_environment');
            $table->dropColumn('environment_id');
        });

        Schema::table('shipments', function (Blueprint $table) {
            $table->dropForeign('fk_shipments_environment');
            $table->dropColumn('environment_id');
        });
    }
};
