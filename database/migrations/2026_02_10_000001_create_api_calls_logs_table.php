<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('api_calls_logs', function (Blueprint $table) {
            $table->id();
            $table->string('request_id')->index();
            $table->foreignId('environment_id')->constrained('merchant_environments');
            $table->foreignId('merchant_id')->constrained('merchants');
            $table->foreignId('account_id')->constrained('accounts');
            $table->foreignId('user_id')->nullable()->constrained('users');
            $table->string('method', 10);
            $table->string('path');
            $table->json('query')->nullable();
            $table->unsignedSmallInteger('status_code');
            $table->unsignedInteger('duration_ms');
            $table->string('ip', 64)->nullable();
            $table->string('user_agent')->nullable();
            $table->longText('response')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('api_calls_logs');
    }
};
