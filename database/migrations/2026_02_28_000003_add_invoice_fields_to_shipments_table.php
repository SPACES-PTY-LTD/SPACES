<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('shipments', 'invoice_number')) {
                $table->string('invoice_number', 120)
                    ->nullable()
                    ->after('delivery_note_number')
                    ->index();
            }

            if (!Schema::hasColumn('shipments', 'invoiced_at')) {
                $table->timestamp('invoiced_at')
                    ->nullable()
                    ->after('invoice_number');
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'invoice_number')) {
                $table->dropColumn('invoice_number');
            }

            if (Schema::hasColumn('shipments', 'invoiced_at')) {
                $table->dropColumn('invoiced_at');
            }
        });
    }
};
