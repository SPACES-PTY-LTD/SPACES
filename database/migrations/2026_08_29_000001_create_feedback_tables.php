<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')->nullable()->constrained('accounts')->nullOnDelete();
            $table->foreignId('merchant_id')->nullable()->constrained('merchants')->nullOnDelete();
            $table->foreignId('submitted_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('status_updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('category', ['bug', 'feature_request', 'general'])->index();
            $table->enum('status', ['open', 'in_progress', 'needs_info', 'resolved', 'closed'])
                ->default('open')
                ->index();
            $table->string('page_path', 2048);
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('status_updated_at')->nullable();
            $table->timestamps(6);

            $table->index(['merchant_id', 'updated_at']);
            $table->index(['submitted_by_user_id', 'updated_at']);
            $table->index(['assigned_to_user_id', 'updated_at']);
        });

        Schema::create('feedback_messages', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('feedback_id')->constrained('feedback')->cascadeOnDelete();
            $table->foreignId('sender_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->enum('author_type', ['submitter', 'reviewer'])->index();
            $table->text('body');
            $table->timestamps(6);

            $table->index(['feedback_id', 'created_at']);
        });

        Schema::create('feedback_read_receipts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('feedback_id')->constrained('feedback')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('last_read_message_id')->nullable()->constrained('feedback_messages')->nullOnDelete();
            $table->timestamp('last_read_at', 6);
            $table->timestamps(6);

            $table->unique(['feedback_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_read_receipts');
        Schema::dropIfExists('feedback_messages');
        Schema::dropIfExists('feedback');
    }
};
