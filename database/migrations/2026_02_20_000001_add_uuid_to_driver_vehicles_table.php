<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('driver_vehicles', 'uuid')) {
            Schema::table('driver_vehicles', function (Blueprint $table) {
                $table->string('uuid', 36)->nullable()->after('id');
            });
        }

        DB::table('driver_vehicles')
            ->whereNull('uuid')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('driver_vehicles')
                        ->where('id', $row->id)
                        ->update(['uuid' => (string) Str::uuid()]);
                }
            });

        try {
            Schema::table('driver_vehicles', function (Blueprint $table) {
                $table->unique('uuid', 'driver_vehicles_uuid_unique');
            });
        } catch (\Throwable $exception) {
            // Ignore when the unique index already exists.
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('driver_vehicles', 'uuid')) {
            return;
        }

        try {
            Schema::table('driver_vehicles', function (Blueprint $table) {
                $table->dropUnique('driver_vehicles_uuid_unique');
            });
        } catch (\Throwable $exception) {
            // Ignore when the unique index does not exist.
        }

        Schema::table('driver_vehicles', function (Blueprint $table) {
            $table->dropColumn('uuid');
        });
    }
};
