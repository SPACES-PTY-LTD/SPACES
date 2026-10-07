<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('run_end_requests', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->constrained('users');
            $table->text('reason');
            $table->string('status')->default('pending');
            $table->foreignId('reviewed_by')->nullable()->constrained('users');
            $table->text('review_reason')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['run_id', 'status']);
        });
        Schema::table('run_costs', fn (Blueprint $table) => $table->uuid('client_request_id')->nullable()->unique());
    }

    public function down(): void
    {
        Schema::table('run_costs', function (Blueprint $table) {
            $table->dropUnique(['client_request_id']);
            $table->dropColumn('client_request_id');
        });
        Schema::dropIfExists('run_end_requests');
    }
};
