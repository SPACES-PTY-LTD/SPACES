<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement('ALTER TABLE merchant_integrations MODIFY integration_data LONGTEXT');
    }

    public function down(): void
    {
        DB::statement('ALTER TABLE merchant_integrations MODIFY integration_data JSON');
    }
};
