<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('route_stops', function (Blueprint $table) {
            $table->dropUnique('uq_route_stops_route_sequence');
            $table->index(['route_id', 'sequence'], 'idx_route_stops_route_sequence');
        });
    }

    public function down(): void
    {
        Schema::table('route_stops', function (Blueprint $table) {
            $table->dropIndex('idx_route_stops_route_sequence');
            $table->unique(['route_id', 'sequence'], 'uq_route_stops_route_sequence');
        });
    }
};
