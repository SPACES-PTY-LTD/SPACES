<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('cancel_reasons', function (Blueprint $table) {
            $table->id();
            $table->string('uuid', 36)->unique();
            $table->string('code')->unique();
            $table->string('title');
            $table->boolean('enabled')->default(true)->index();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cancel_reasons');
    }
};
