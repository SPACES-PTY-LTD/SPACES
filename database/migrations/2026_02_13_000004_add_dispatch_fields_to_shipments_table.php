<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (!Schema::hasColumn('shipments', 'service_type')) {
                $table->string('service_type', 50)->nullable()->after('collection_date')->index();
            }

            if (!Schema::hasColumn('shipments', 'priority')) {
                $table->string('priority', 20)->default('normal')->after('service_type')->index();
            }

            if (!Schema::hasColumn('shipments', 'auto_assign')) {
                $table->boolean('auto_assign')->default(true)->after('priority')->index();
            }

            if (!Schema::hasColumn('shipments', 'notes')) {
                $table->text('notes')->nullable()->after('auto_assign');
            }
        });
    }

    public function down(): void
    {
        Schema::table('shipments', function (Blueprint $table) {
            if (Schema::hasColumn('shipments', 'notes')) {
                $table->dropColumn('notes');
            }

            if (Schema::hasColumn('shipments', 'auto_assign')) {
                $table->dropColumn('auto_assign');
            }

            if (Schema::hasColumn('shipments', 'priority')) {
                $table->dropColumn('priority');
            }

            if (Schema::hasColumn('shipments', 'service_type')) {
                $table->dropColumn('service_type');
            }
        });
    }
};
