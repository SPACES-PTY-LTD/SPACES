<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (!Schema::hasColumn('merchants', 'imports_stats')) {
                $table->json('imports_stats')->nullable()->after('setup_completed_at');
            }
        });

        if (Schema::hasColumn('merchants', 'imports_in_progress') && Schema::hasColumn('merchants', 'imports_stats')) {
            DB::table('merchants')->select(['id', 'imports_in_progress'])->orderBy('id')->chunk(200, function ($merchants): void {
                foreach ($merchants as $merchant) {
                    $decoded = is_string($merchant->imports_in_progress)
                        ? json_decode($merchant->imports_in_progress, true)
                        : (is_array($merchant->imports_in_progress) ? $merchant->imports_in_progress : []);
                    $inProgress = is_array($decoded) ? $decoded : [];
                    $stats = [
                        'inprogress' => [
                            'locations' => $inProgress['locations'] ?? null,
                            'drivers' => $inProgress['drivers'] ?? null,
                            'vehicles' => $inProgress['vehicles'] ?? null,
                        ],
                        'last_import_counts' => [
                            'locations' => 0,
                            'drivers' => 0,
                            'vehicles' => 0,
                        ],
                        'last_import_errors' => [
                            'locations' => null,
                            'drivers' => null,
                            'vehicles' => null,
                        ],
                    ];

                    DB::table('merchants')
                        ->where('id', (int) $merchant->id)
                        ->update(['imports_stats' => json_encode($stats)]);
                }
            });
        }

        Schema::table('merchants', function (Blueprint $table) {
            if (Schema::hasColumn('merchants', 'imports_in_progress')) {
                $table->dropColumn('imports_in_progress');
            }
        });
    }

    public function down(): void
    {
        Schema::table('merchants', function (Blueprint $table) {
            if (!Schema::hasColumn('merchants', 'imports_in_progress')) {
                $table->json('imports_in_progress')->nullable()->after('setup_completed_at');
            }
        });

        if (Schema::hasColumn('merchants', 'imports_stats') && Schema::hasColumn('merchants', 'imports_in_progress')) {
            DB::table('merchants')->select(['id', 'imports_stats'])->orderBy('id')->chunk(200, function ($merchants): void {
                foreach ($merchants as $merchant) {
                    $decoded = is_string($merchant->imports_stats)
                        ? json_decode($merchant->imports_stats, true)
                        : (is_array($merchant->imports_stats) ? $merchant->imports_stats : []);
                    $stats = is_array($decoded) ? $decoded : [];
                    $inProgress = $stats['inprogress'] ?? [];

                    DB::table('merchants')
                        ->where('id', (int) $merchant->id)
                        ->update([
                            'imports_in_progress' => json_encode([
                                'locations' => $inProgress['locations'] ?? null,
                                'drivers' => $inProgress['drivers'] ?? null,
                                'vehicles' => $inProgress['vehicles'] ?? null,
                            ]),
                        ]);
                }
            });
        }

        Schema::table('merchants', function (Blueprint $table) {
            if (Schema::hasColumn('merchants', 'imports_stats')) {
                $table->dropColumn('imports_stats');
            }
        });
    }
};
