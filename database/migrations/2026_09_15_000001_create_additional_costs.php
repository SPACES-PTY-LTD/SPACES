<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchants', fn (Blueprint $table) => $table->char('currency', 3)->default('ZAR'));
        Schema::create('location_costs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('location_id')->constrained()->cascadeOnDelete();
            $table->string('title');
            $table->decimal('amount', 18, 4);
            $table->char('currency', 3);
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('run_costs', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('run_id')->constrained()->cascadeOnDelete();
            $table->foreignId('location_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('location_cost_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('vehicle_activity_id')->nullable()->constrained('vehicle_activity')->nullOnDelete();
            $table->string('location_name')->nullable();
            $table->timestamp('visited_at')->nullable();
            $table->string('source', 16);
            $table->string('title');
            $table->decimal('amount', 18, 4);
            $table->char('currency', 3);
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
            $table->softDeletes();
            $table->unique(['run_id', 'vehicle_activity_id', 'location_cost_id'], 'run_visit_cost_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('run_costs');
        Schema::dropIfExists('location_costs');
        Schema::table('merchants', fn (Blueprint $table) => $table->dropColumn('currency'));
    }
};
