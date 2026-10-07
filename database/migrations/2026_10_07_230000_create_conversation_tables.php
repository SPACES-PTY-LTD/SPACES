<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('conversations', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('type');
            $table->unsignedBigInteger('type_entry_id')->nullable();
            $table->string('title')->nullable();
            $table->text('description')->nullable();
            $table->string('status')->default('active');
            $table->boolean('is_private')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['account_id', 'merchant_id', 'type', 'type_entry_id'], 'conversation_driver_unique');
            $table->index(['account_id', 'merchant_id', 'updated_at']);
        });
        Schema::create('conversation_members', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default('member');
            $table->string('state')->default('active');
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['conversation_id', 'user_id']);
            $table->index(['account_id', 'merchant_id', 'user_id']);
        });
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('conversation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('text');
            $table->string('temporary_id')->nullable();
            $table->text('body')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['conversation_id', 'user_id', 'temporary_id'], 'message_retry_unique');
            $table->index(['merchant_id', 'conversation_id', 'created_at']);
            $table->index(['account_id', 'merchant_id']);
            $table->index(['merchant_id', 'user_id']);
            $table->index(['merchant_id', 'type']);
        });
        Schema::create('message_attachments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('message_id')->constrained()->cascadeOnDelete();
            $table->string('type')->default('file');
            $table->string('path');
            $table->text('url')->nullable();
            $table->string('filename')->nullable();
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->nullable();
            $table->json('meta')->nullable();
            $table->timestamps();
            $table->softDeletes();
            $table->index(['account_id', 'merchant_id']);
            $table->index(['merchant_id', 'message_id']);
            $table->index(['merchant_id', 'message_id', 'path'], 'message_attachment_path_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('message_attachments');
        Schema::dropIfExists('messages');
        Schema::dropIfExists('conversation_members');
        Schema::dropIfExists('conversations');
    }
};
