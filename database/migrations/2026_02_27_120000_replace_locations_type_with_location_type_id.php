<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    private const LOCATION_TYPE_SEQUENCE = [
        'depot' => 1,
        'pickup' => 2,
        'dropoff' => 3,
        'service' => 4,
        'waypoint' => 5,
        'break' => 6,
        'fuel' => 7,
    ];

    public function up(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'location_type_id')) {
                $table->foreignId('location_type_id')
                    ->nullable()
                    ->after('is_loading_location')
                    ->constrained('location_types')
                    ->nullOnDelete()
                    ->name('fk_locations_location_type')
                    ->index('idx_locations_location_type');
            }
        });

        if (!Schema::hasColumn('locations', 'type')) {
            return;
        }

        $this->backfillLocationTypeIds();

        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'type')) {
                $table->dropIndex('idx_locations_type');
                $table->dropColumn('type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('locations', function (Blueprint $table) {
            if (!Schema::hasColumn('locations', 'type')) {
                $table->string('type', 32)
                    ->default('waypoint')
                    ->after('is_loading_location')
                    ->index('idx_locations_type');
            }
        });

        if (Schema::hasColumn('locations', 'location_type_id')) {
            DB::statement("
                UPDATE locations
                SET type = COALESCE(
                    (SELECT slug FROM location_types WHERE location_types.id = locations.location_type_id),
                    'waypoint'
                )
            ");
        }

        Schema::table('locations', function (Blueprint $table) {
            if (Schema::hasColumn('locations', 'location_type_id')) {
                $table->dropForeign('fk_locations_location_type');
                $table->dropIndex('idx_locations_location_type');
                $table->dropColumn('location_type_id');
            }
        });
    }

    private function backfillLocationTypeIds(): void
    {
        $rows = DB::table('locations')
            ->select(['id', 'merchant_id', 'account_id', 'type'])
            ->get();

        $typeIdsByMerchantAndSlug = [];

        foreach ($rows as $row) {
            $slug = $this->normalizeSlug($row->type);
            $merchantId = (int) $row->merchant_id;

            if (!isset($typeIdsByMerchantAndSlug[$merchantId][$slug])) {
                $typeId = DB::table('location_types')
                    ->where('merchant_id', $merchantId)
                    ->where('slug', $slug)
                    ->value('id');

                if (!$typeId) {
                    $typeId = DB::table('location_types')->insertGetId([
                        'uuid' => (string) Str::uuid(),
                        'account_id' => $row->account_id,
                        'merchant_id' => $merchantId,
                        'slug' => $slug,
                        'title' => $this->titleFromSlug($slug),
                        'collection_point' => in_array($slug, ['depot', 'pickup'], true),
                        'delivery_point' => $slug === 'service',
                        'sequence' => self::LOCATION_TYPE_SEQUENCE[$slug] ?? 999,
                        'icon' => null,
                        'color' => null,
                        'default' => $slug === 'depot',
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }

                $typeIdsByMerchantAndSlug[$merchantId][$slug] = (int) $typeId;
            }

            DB::table('locations')
                ->where('id', $row->id)
                ->update(['location_type_id' => $typeIdsByMerchantAndSlug[$merchantId][$slug]]);
        }
    }

    private function normalizeSlug($value): string
    {
        $slug = Str::slug((string) ($value ?? ''));

        return array_key_exists($slug, self::LOCATION_TYPE_SEQUENCE) ? $slug : 'waypoint';
    }

    private function titleFromSlug(string $slug): string
    {
        return ucfirst($slug);
    }
};
