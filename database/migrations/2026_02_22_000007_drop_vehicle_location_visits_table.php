<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('vehicle_location_visits');
    }

    public function down(): void
    {
        // Intentionally left empty. Older migration still defines the original table structure.
    }
};
