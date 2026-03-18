<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (!Schema::hasColumn('vehicles', 'account_id')) {
                $table->foreignId('account_id')
                    ->nullable()
                    ->after('uuid')
                    ->constrained('accounts')
                    ->nullOnDelete()
                    ->name('fk_vehicles_account')
                    ->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('vehicles', function (Blueprint $table) {
            if (Schema::hasColumn('vehicles', 'account_id')) {
                $table->dropForeign('fk_vehicles_account');
                $table->dropColumn('account_id');
            }
        });
    }
};
