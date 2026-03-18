<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('idempotency_keys', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_idempotency_keys_merchant')
                ->index();
            $table->string('key')->index();
            $table->string('request_hash')->index();
            $table->unsignedInteger('response_code');
            $table->longText('response_body');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('idempotency_keys');
    }
};
