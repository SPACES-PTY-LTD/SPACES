<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('locations', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->foreignId('account_id')
                ->constrained('accounts')
                ->cascadeOnDelete()
                ->name('fk_locations_account')
                ->index();
            $table->foreignId('merchant_id')
                ->constrained('merchants')
                ->cascadeOnDelete()
                ->name('fk_locations_merchant')
                ->index();
            $table->foreignId('environment_id')
                ->nullable()
                ->constrained('merchant_environments')
                ->nullOnDelete()
                ->name('fk_locations_environment')
                ->index();
            $table->string('name')->nullable();
            $table->string('code', 100)->nullable();
            $table->string('company')->nullable();
            $table->string('address_line_1');
            $table->string('address_line_2')->nullable();
            $table->string('town')->nullable();
            $table->string('city');
            $table->string('country')->nullable();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('phone')->nullable();
            $table->string('province');
            $table->string('post_code');
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('google_place_id')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['account_id', 'environment_id', 'merchant_id', 'code'], 'locations_unique_code');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('locations');
    }
};
