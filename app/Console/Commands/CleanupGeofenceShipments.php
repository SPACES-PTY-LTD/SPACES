<?php

namespace App\Console\Commands;

use App\Services\GeofenceShipmentCleanupService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Throwable;

class CleanupGeofenceShipments extends Command
{
    protected $signature = 'shipments:cleanup-geofence
        {mode=audit : audit, apply or restore}
        {--merchant= : Merchant UUID for audit}
        {--from= : Inclusive ISO 8601 creation-event time with zone}
        {--to= : Exclusive ISO 8601 creation-event time with zone}
        {--run= : Optional run UUID for audit}
        {--audit= : Completed audit UUID for apply}
        {--all-candidates : Apply every cleanup candidate in the specified audit}
        {--shipment=* : Explicit reviewed shipment UUID; repeat to select multiple}
        {--batch= : Cleanup batch UUID for restore}';

    protected $description = 'Audit, reversibly clean, or restore reviewed false geofence shipments';

    public function handle(GeofenceShipmentCleanupService $service): int
    {
        try {
            $mode = $this->argument('mode');
            $allowed = match ($mode) {
                'audit' => ['merchant', 'from', 'to', 'run'],
                'apply' => ['audit', 'shipment', 'all-candidates'],
                'restore' => ['batch'],
                default => throw new \InvalidArgumentException('Mode must be audit, apply or restore.'),
            };
            foreach (['merchant', 'from', 'to', 'run', 'audit', 'shipment', 'batch', 'all-candidates'] as $option) {
                if ($this->option($option) && ! in_array($option, $allowed, true)) {
                    throw new \InvalidArgumentException("--$option is not valid for $mode.");
                }
            }
            if ($mode === 'audit') {
                foreach (['merchant', 'from', 'to'] as $required) {
                    if (! $this->option($required)) {
                        throw new \InvalidArgumentException("--$required is required for audit.");
                    }
                }
                $id = $service->audit($this->option('merchant'), $this->option('from'), $this->option('to'), $this->option('run'), function (string $batch, int $processed) {
                    $this->line("Audit $batch: $processed shipments processed");
                });
            } elseif ($mode === 'apply') {
                if (! $this->option('audit')) {
                    throw new \InvalidArgumentException('--audit is required for apply.');
                }
                $id = $service->apply($this->option('audit'), $this->option('shipment'), (bool) $this->option('all-candidates'));
            } else {
                if (! $this->option('batch')) {
                    throw new \InvalidArgumentException('--batch is required for restore.');
                }
                $id = $this->option('batch');
                foreach ($service->restore($id) as $shipment => $status) {
                    $this->line("$shipment: $status");
                }
            }
            $this->info("$mode batch: $id");
            $this->export($id);
            $counts = DB::table('geofence_cleanup_items')->where('batch_uuid', $id)->selectRaw('classification, status, COUNT(*) as total')->groupBy('classification', 'status')->get();
            $this->table(['Classification', 'Status', 'Count'], $counts->map(fn ($r) => [$r->classification, $r->status, $r->total]));

            return DB::table('geofence_cleanup_batches')->where('uuid', $id)->value('status') === 'partial' ? self::FAILURE : self::SUCCESS;
        } catch (Throwable $e) {
            $this->error($e->getMessage());

            return self::FAILURE;
        }
    }

    private function export(string $batch): void
    {
        $directory = storage_path('app/private/geofence-cleanup/'.$batch);
        if (! is_dir($directory) && ! mkdir($directory, 0700, true) && ! is_dir($directory)) {
            throw new \RuntimeException('Cannot create report directory.');
        }
        $json = fopen($directory.'/report.json', 'w');
        $csv = fopen($directory.'/report.csv', 'w');
        if (! $json || ! $csv) {
            throw new \RuntimeException('Cannot write cleanup reports.');
        }
        chmod($directory.'/report.json', 0600);
        chmod($directory.'/report.csv', 0600);
        try {
            $record = DB::table('geofence_cleanup_batches')->where('uuid', $batch)->first();
            $scope = json_decode($record->scope, true, flags: JSON_THROW_ON_ERROR);
            fwrite($json, '{"batch":'.json_encode($batch).',"scope":'.json_encode($scope, JSON_THROW_ON_ERROR).',"items":[');
            $columns = ['shipment_uuid', 'reference', 'run_uuid', 'location_uuid', 'location_name', 'creation_time', 'creation_latitude', 'creation_longitude', 'classification', 'status', 'polygon_fingerprint', 'interior_observations', 'coverage', 'reasons', 'proposed_changes', 'error'];
            fputcsv($csv, $columns, escape: '');
            $first = true;
            foreach (DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->orderBy('id')->cursor() as $item) {
                $data = json_decode($item->evidence, true, flags: JSON_THROW_ON_ERROR);
                $data['status'] = $item->status;
                $data['error'] = $item->error;
                fwrite($json, ($first ? '' : ',').json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES));
                $first = false;
                fputcsv($csv, array_map(function ($key) use ($data) {
                    $value = $data[$key] ?? '';
                    $value = is_array($value) ? json_encode($value, JSON_THROW_ON_ERROR) : (string) $value;

                    return preg_match('/^[=+@\-\t\r]/', $value) ? "'".$value : $value;
                }, $columns), escape: '');
            }
            fwrite($json, ']}');
        } finally {
            fclose($json);
            fclose($csv);
        }
        $this->info("Reports: $directory/report.json and report.csv");
    }
}
