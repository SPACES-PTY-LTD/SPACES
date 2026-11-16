<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('data_purges', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            // Nullable unique slot permits history but only one active request per merchant.
            $table->unsignedBigInteger('active_merchant_id')->nullable()->unique();
            $table->string('status')->default('queued');
            $table->json('types');
            $table->json('result')->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
            $table->index(['merchant_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('data_purges');
    }
};
