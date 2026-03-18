<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('file_types', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('entity_type', 32);
            $table->string('name');
            $table->string('slug');
            $table->text('description')->nullable();
            $table->boolean('requires_expiry')->default(false);
            $table->boolean('driver_can_upload')->default(false);
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'entity_type', 'slug'], 'file_types_merchant_entity_slug_unique');
            $table->index(['merchant_id', 'entity_type', 'is_active'], 'file_types_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('file_types');
    }
};
