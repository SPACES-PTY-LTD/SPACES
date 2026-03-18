<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('route_stops', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('route_id')
                ->constrained('routes')
                ->cascadeOnDelete()
                ->name('fk_route_stops_route')
                ->index();
            $table->foreignId('location_id')
                ->constrained('locations')
                ->cascadeOnDelete()
                ->name('fk_route_stops_location')
                ->index();
            $table->unsignedInteger('sequence');
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['route_id', 'sequence'], 'uq_route_stops_route_sequence');
            $table->index(['route_id', 'location_id'], 'idx_route_stops_location');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('route_stops');
    }
};
