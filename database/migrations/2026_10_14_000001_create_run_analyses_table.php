<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('run_analyses', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('environment_id')->nullable()->constrained('merchant_environments')->nullOnDelete();
            $table->foreignId('run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('requested_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 20)->default('queued');
            $table->uuid('request_key');
            $table->string('fingerprint', 64)->nullable();
            $table->string('model', 100)->nullable();
            $table->string('prompt_version', 32)->default('run-analysis-v1');
            $table->json('input_snapshot')->nullable();
            $table->json('report')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();
            $table->unique(['run_id', 'request_key']);
            $table->index(['run_id', 'status', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('run_analyses');
    }
};
