<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchants', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('owner_user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->name('fk_merchants_owner_user')
                ->index();
            $table->string('name');
            $table->string('legal_name')->nullable();
            $table->enum('status', ['active', 'suspended'])->default('active')->index();
            $table->string('billing_email')->nullable();
            $table->string('default_webhook_url')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchants');
    }
};
