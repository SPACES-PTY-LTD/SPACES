<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Independent of the operation row locked by the deletion transaction.
        Schema::create('data_purge_cancellations', function (Blueprint $table) {
            $table->uuid('purge_uuid')->primary();
            $table->timestamp('requested_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_purge_cancellations');
    }
};
