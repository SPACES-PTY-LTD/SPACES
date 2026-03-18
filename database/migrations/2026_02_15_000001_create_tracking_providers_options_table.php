<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracking_providers_options', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('provider_id')
                ->constrained('tracking_providers')
                ->cascadeOnDelete()
                ->name('fk_tracking_provider_options_provider')
                ->index();
            $table->string('label');
            $table->string('name');
            $table->enum('type', ['text', 'select', 'boolean', 'password']);
            $table->json('options')->nullable();
            $table->unsignedInteger('order_id')->default(0);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_providers_options');
    }
};
