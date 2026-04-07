<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tags', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->constrained()->cascadeOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->string('name', 80);
            $table->string('slug', 100);
            $table->timestamps();

            $table->unique(['merchant_id', 'slug'], 'tags_merchant_slug_unique');
            $table->index(['merchant_id', 'name'], 'tags_merchant_name_idx');
        });

        Schema::create('taggables', function (Blueprint $table) {
            $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
            $table->morphs('taggable');
            $table->timestamps();

            $table->primary(['tag_id', 'taggable_type', 'taggable_id'], 'taggables_primary');
            $table->index(['taggable_type', 'taggable_id'], 'taggables_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('taggables');
        Schema::dropIfExists('tags');
    }
};
