<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('api_calls_logs', function (Blueprint $table) {
            $table->string('source')->nullable()->after('user_id');
            $table->string('origin_url')->nullable()->after('source');
            $table->string('idempotency_key')->nullable()->after('origin_url');
        });
    }

    public function down(): void
    {
        Schema::table('api_calls_logs', function (Blueprint $table) {
            $table->dropColumn(['source', 'origin_url', 'idempotency_key']);
        });
    }
};
