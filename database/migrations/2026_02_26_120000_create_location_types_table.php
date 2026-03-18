<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_types', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->constrained('accounts')
                ->cascadeOnDelete()
                ->name('fk_location_types_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_location_types_merchant')
                ->index();
            $table->string('slug', 100);
            $table->string('title');
            $table->boolean('collection_point')->default(false);
            $table->unsignedInteger('sequence')->default(0);
            $table->string('icon')->nullable();
            $table->string('color', 32)->nullable();
            $table->boolean('default')->default(false);
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'slug'], 'location_types_merchant_slug_unique');
            $table->index(['merchant_id', 'sequence'], 'idx_location_types_merchant_sequence');
            $table->index(['merchant_id', 'default'], 'idx_location_types_merchant_default');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('location_types');
    }
};
