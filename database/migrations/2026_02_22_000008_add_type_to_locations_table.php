<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->string('type', 32)
                ->default('waypoint')
                ->after('is_loading_location')
                ->index('idx_locations_type');
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            $table->dropIndex('idx_locations_type');
            $table->dropColumn('type');
        });
    }
};
