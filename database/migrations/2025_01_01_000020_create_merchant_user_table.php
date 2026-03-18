<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_merchant_user_merchant')
                ->index();
            $table->foreignId('user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->name('fk_merchant_user_user')
                ->index();
            $table->enum('role', ['owner', 'admin', 'developer', 'billing', 'read_only'])->index();
            $table->timestamps();

            $table->unique(['merchant_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_user');
    }
};
