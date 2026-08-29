<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->unsignedInteger('estimated_waiting_time')
                ->nullable()
                ->after('email');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropColumn('estimated_waiting_time');
        });
    }
};
