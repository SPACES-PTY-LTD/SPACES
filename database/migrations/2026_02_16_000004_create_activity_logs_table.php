<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();

            $table->foreignId('account_id')->nullable()->index();
            $table->foreignId('merchant_id')->nullable()->index();
            $table->foreignId('environment_id')->nullable()->index();
            $table->foreignId('actor_user_id')->nullable()->index();

            $table->string('action', 50)->index();
            $table->string('entity_type', 50)->index();
            $table->unsignedBigInteger('entity_id')->nullable()->index();
            $table->string('entity_uuid', 36)->nullable()->index();
            $table->string('title')->nullable();

            $table->json('changes')->nullable();
            $table->json('metadata')->nullable();

            $table->string('request_id')->nullable()->index();
            $table->string('ip_address', 64)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('occurred_at')->index();

            $table->timestamps();

            $table->foreign('account_id', 'fk_activity_logs_account')
                ->references('id')
                ->on('accounts')
                ->nullOnDelete();
            $table->foreign('merchant_id', 'fk_activity_logs_merchant')
                ->references('id')
                ->on('merchants')
                ->nullOnDelete();
            $table->foreign('environment_id', 'fk_activity_logs_environment')
                ->references('id')
                ->on('merchant_environments')
                ->nullOnDelete();
            $table->foreign('actor_user_id', 'fk_activity_logs_actor_user')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activity_logs');
    }
};
