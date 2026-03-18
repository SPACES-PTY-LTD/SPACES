<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'is_loading_location')) {
                $table->dropIndex('idx_locations_loading');
                $table->dropColumn('is_loading_location');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'is_loading_location')) {
                $table->boolean('is_loading_location')
                    ->default(false)
                    ->after('google_place_id')
                    ->index('idx_locations_loading');
            }
        });
    }
};
