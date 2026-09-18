<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('delivery_note_imports', function (Blueprint $table) {
            $table->unsignedBigInteger('run_id')->nullable()->change();
            $table->json('reviewed_data')->nullable();
            $table->json('confirmation_result')->nullable();
        });
    }

    public function down(): void
    {
        if (\Illuminate\Support\Facades\DB::table('delivery_note_imports')->whereNull('run_id')->exists()) {
            throw new \RuntimeException('Standalone driver imports must be retained or assigned a run before rollback.');
        }
        Schema::table('delivery_note_imports', function (Blueprint $table) {
            $table->dropColumn(['reviewed_data', 'confirmation_result']);
            $table->unsignedBigInteger('run_id')->nullable(false)->change();
        });
    }
};
