<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_environments', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_merchant_envs_merchant')
                ->index();
            $table->string('name');
            $table->string('color', 32);
            $table->string('url');
            $table->string('token_hash', 64)->index();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_environments');
    }
};
