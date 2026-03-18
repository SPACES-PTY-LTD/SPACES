<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE quotes MODIFY status ENUM('created','expired','booked') DEFAULT 'created'");
    }

    public function down(): void
    {
        DB::statement("ALTER TABLE quotes MODIFY status ENUM('created','expired') DEFAULT 'created'");
    }
};
