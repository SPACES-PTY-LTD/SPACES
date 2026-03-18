<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('bookings', function (Blueprint $table) {
                $table->unsignedBigInteger('quote_option_id')->nullable()->change();
            });

            return;
        }

        DB::statement('ALTER TABLE bookings MODIFY quote_option_id BIGINT UNSIGNED NULL');
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            Schema::table('bookings', function (Blueprint $table) {
                $table->unsignedBigInteger('quote_option_id')->nullable(false)->change();
            });

            return;
        }

        DB::statement('ALTER TABLE bookings MODIFY quote_option_id BIGINT UNSIGNED NOT NULL');
    }
};
