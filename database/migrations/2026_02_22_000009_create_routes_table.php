<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('routes', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->nullable()
                ->constrained('accounts')
                ->nullOnDelete()
                ->name('fk_routes_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_routes_merchant')
                ->index();
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_routes_environment')
                ->index();
            $table->string('title');
            $table->string('code', 120);
            $table->text('description')->nullable();
            $table->decimal('estimated_distance', 10, 2)->nullable();
            $table->unsignedInteger('estimated_duration')->nullable();
            $table->unsignedInteger('estimated_collection_time')->nullable();
            $table->unsignedInteger('estimated_delivery_time')->nullable();
            $table->boolean('auto_created')->default(false)->index();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['merchant_id', 'code'], 'uq_routes_merchant_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('routes');
    }
};
