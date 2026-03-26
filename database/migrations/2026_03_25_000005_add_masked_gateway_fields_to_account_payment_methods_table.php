<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('account_payment_methods', function (Blueprint $table) {
            if (!Schema::hasColumn('account_payment_methods', 'funding_type')) {
                $table->string('funding_type')->nullable()->after('expiry_year');
            }
            if (!Schema::hasColumn('account_payment_methods', 'bank')) {
                $table->string('bank')->nullable()->after('funding_type');
            }
            if (!Schema::hasColumn('account_payment_methods', 'signature')) {
                $table->string('signature')->nullable()->after('bank');
            }
            if (!Schema::hasColumn('account_payment_methods', 'is_reusable')) {
                $table->boolean('is_reusable')->default(true)->after('signature');
            }
            if (!Schema::hasColumn('account_payment_methods', 'retrieved_from_gateway')) {
                $table->boolean('retrieved_from_gateway')->default(false)->after('is_reusable');
            }
        });
    }

    public function down(): void
    {
        Schema::table('account_payment_methods', function (Blueprint $table) {
            $columns = array_filter([
                Schema::hasColumn('account_payment_methods', 'funding_type') ? 'funding_type' : null,
                Schema::hasColumn('account_payment_methods', 'bank') ? 'bank' : null,
                Schema::hasColumn('account_payment_methods', 'signature') ? 'signature' : null,
                Schema::hasColumn('account_payment_methods', 'is_reusable') ? 'is_reusable' : null,
                Schema::hasColumn('account_payment_methods', 'retrieved_from_gateway') ? 'retrieved_from_gateway' : null,
            ]);

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }
};
