<?php

namespace App\Console\Commands;

use App\Models\Merchant;
use App\Services\VehicleActivityService;
use Illuminate\Console\Command;
use Throwable;

class ExplainVehicleMonitoring extends Command
{
    protected $signature = 'monitoring:explain {merchant : Merchant UUID}';

    protected $description = 'Compare monitoring query plans and required indexes without executing the fleet query';

    public function handle(VehicleActivityService $service): int
    {
        $merchant = Merchant::where('uuid', $this->argument('merchant'))->first();
        if (! $merchant) {
            $this->error('Merchant not found.');

            return self::FAILURE;
        }

        $connection = $merchant->getConnection();
        if (! in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            $this->error('This diagnostic requires MySQL or MariaDB.');

            return self::FAILURE;
        }

        $indexes = $connection->getSchemaBuilder()->getIndexes('vehicle_activity');
        foreach (['va_monitoring_latest', 'va_monitoring_transition'] as $required) {
            if (! collect($indexes)->contains('name', $required)) {
                $this->error("Missing required index: {$required}. Apply the monitoring index migration first.");

                return self::FAILURE;
            }
        }
        try {
            foreach ([false, true] as $hinted) {
                $query = $service->monitoringVehicleQuery($merchant, $hinted);
                // EXPLAIN only: never EXPLAIN ANALYZE, which executes the query.
                $plan = $connection->select('EXPLAIN '.$query->toSql(), $query->getBindings());
                $this->info($hinted ? 'Explicit monitoring indexes' : 'Optimizer-selected indexes');
                $this->line(json_encode($plan, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES));
            }
        } catch (Throwable $exception) {
            $this->error($exception->getMessage());

            return self::FAILURE;
        }

        return self::SUCCESS;
    }
}
