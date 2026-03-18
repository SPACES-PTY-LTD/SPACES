<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('location_types', function (Blueprint $table) {
            $table->boolean('delivery_point')
                ->default(false)
                ->after('collection_point');
        });
    }

    public function down(): void
    {
        Schema::table('location_types', function (Blueprint $table) {
            $table->dropColumn('delivery_point');
        });
    }
};
