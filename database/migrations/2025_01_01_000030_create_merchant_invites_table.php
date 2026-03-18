<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('merchant_invites', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_merchant_invites_merchant')
                ->index();
            $table->foreignId('invited_by_user_id')
                ->constrained('users')
                ->cascadeOnDelete()
                ->name('fk_merchant_invites_inviter')
                ->index();
            $table->string('email')->index();
            $table->enum('role', ['admin', 'developer', 'billing', 'read_only'])->index();
            $table->string('token_hash')->index();
            $table->timestamp('expires_at')->index();
            $table->timestamp('accepted_at')->nullable()->index();
            $table->timestamp('revoked_at')->nullable()->index();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'email', 'revoked_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('merchant_invites');
    }
};
