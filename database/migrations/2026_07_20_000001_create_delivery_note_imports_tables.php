<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('delivery_note_imports', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('account_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('merchant_id')->constrained()->cascadeOnDelete();
            $table->foreignId('environment_id')->nullable()->constrained('merchant_environments')->nullOnDelete();
            $table->foreignId('run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('status', 32)->default('analyzed')->index();
            $table->string('disk', 64);
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type', 191);
            $table->unsignedBigInteger('size_bytes');
            $table->string('model', 100)->nullable();
            $table->json('extracted_data')->nullable();
            $table->text('failure_message')->nullable();
            $table->timestamp('confirmed_at')->nullable();
            $table->timestamps();

            $table->index(['run_id', 'status']);
        });

        Schema::create('delivery_note_import_shipments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('delivery_note_import_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shipment_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['delivery_note_import_id', 'shipment_id'], 'delivery_note_import_shipment_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('delivery_note_import_shipments');
        Schema::dropIfExists('delivery_note_imports');
    }
};
