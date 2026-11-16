<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Advisory progress only; completion is always read from the committed operation. */
class DataPurgeProgress
{
    private function store()
    {
        $name = config('cache.default');
        $settings = config("cache.stores.{$name}");
        if (($settings['driver'] ?? null) === 'database') {
            // Progress must be visible while the deletion transaction is open.
            // Use a separate connection and cache rows, never the locked operation row.
            config(['database.connections.purge_progress' => DB::connection($settings['connection'] ?? null)->getConfig()]);
            $settings['connection'] = 'purge_progress';

            return Cache::build($settings);
        }

        return Cache::store($name);
    }

    public function write(string $uuid, int $done, int $total, ?string $type, array $orderedTypes = []): void
    {
        try {
            $this->store()->put('data-purge-progress:'.$uuid, [
                'completed_types' => $done,
                'total_types' => $total,
                'current_type' => $type,
                'ordered_types' => $orderedTypes,
                'processed_types' => array_slice($orderedTypes, 0, $done),
                // Reserve the final step for audit and transaction commit.
                'percent' => (int) floor(100 * $done / ($total + 1)),
            ], now()->addHour());
        } catch (Throwable $e) {
            report($e);
        }
    }

    public function read(string $uuid): ?array
    {
        try {
            return $this->store()->get('data-purge-progress:'.$uuid);
        } catch (Throwable $e) {
            report($e);

            return null;
        }
    }
}
