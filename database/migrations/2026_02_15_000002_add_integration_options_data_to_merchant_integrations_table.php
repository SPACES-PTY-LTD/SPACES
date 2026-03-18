<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchant_integrations', function (Blueprint $table) {
            $table->json('integration_options_data')->nullable()->after('integration_data');
        });
    }

    public function down(): void
    {
        Schema::table('merchant_integrations', function (Blueprint $table) {
            $table->dropColumn('integration_options_data');
        });
    }
};
