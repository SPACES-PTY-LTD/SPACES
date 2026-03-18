<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('entity_files', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('file_type_id')->constrained('file_types')->cascadeOnDelete();
            $table->morphs('attachable');
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('uploaded_by_role', 32)->nullable();
            $table->string('disk', 64)->default('s3');
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 191)->nullable();
            $table->unsignedBigInteger('size_bytes')->default(0);
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['merchant_id', 'attachable_type', 'attachable_id'], 'entity_files_attachable_lookup_idx');
            $table->index(['merchant_id', 'file_type_id'], 'entity_files_file_type_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('entity_files');
    }
};
