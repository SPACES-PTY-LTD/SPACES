<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->boolean('schedule_managed')->default(false);
            $table->uuid('schedule_request_id')->nullable()->unique();
            $table->string('schedule_request_hash', 64)->nullable();
            $table->index(['merchant_id', 'schedule_managed', 'status', 'planned_start_at'], 'runs_schedule_readiness_index');
        });
    }

    public function down(): void
    {
        Schema::table('runs', function (Blueprint $table) {
            $table->dropIndex('runs_schedule_readiness_index');
            $table->dropUnique(['schedule_request_id']);
            $table->dropColumn(['schedule_managed', 'schedule_request_id', 'schedule_request_hash']);
        });
    }
};
