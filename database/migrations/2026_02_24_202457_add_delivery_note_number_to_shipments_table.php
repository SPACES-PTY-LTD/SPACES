<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('shipments', 'delivery_note_number')) {
                $table->string('delivery_note_number', 120)
                    ->nullable()
                    ->after('merchant_order_ref')
                    ->index();
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'delivery_note_number')) {
                $table->dropColumn('delivery_note_number');
            }
        });
    }
};
