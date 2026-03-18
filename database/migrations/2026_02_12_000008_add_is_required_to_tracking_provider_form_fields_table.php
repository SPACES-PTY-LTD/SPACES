<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tracking_providers_integration_form_fields', function (Blueprint $table) {
            $table->boolean('is_required')->default(false)->after('type');
        });
    }

    public function down(): void
    {
        Schema::table('tracking_providers_integration_form_fields', function (Blueprint $table) {
            $table->dropColumn('is_required');
        });
    }
};
