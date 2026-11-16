<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;

class DataPurgeCancellation
{
    public function request(string $uuid): void
    {
        DB::table('data_purge_cancellations')->insertOrIgnore([
            'purge_uuid' => $uuid, 'requested_at' => now(),
        ]);
    }

    public function requested(string $uuid): bool
    {
        $connection = DB::connection();
        // Read outside the worker's repeatable-read transaction so a new request
        // is visible without contending for the locked data_purges row.
        if ($connection->transactionLevel() > 0 && $connection->getDriverName() !== 'sqlite') {
            config(['database.connections.purge_control' => $connection->getConfig()]);
            $connection = DB::connection('purge_control');
        }

        return $connection->table('data_purge_cancellations')->useWritePdo()->where('purge_uuid', $uuid)->exists();
    }

    public function check(string $uuid): void
    {
        if ($this->requested($uuid)) {
            throw new \App\Exceptions\DataPurgeCancelled;
        }
    }
}
