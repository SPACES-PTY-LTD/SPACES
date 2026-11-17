<?php

namespace App\Services;

use App\Jobs\DeleteMerchantFilesJob;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DataPurgeService
{
    private const EXECUTION_ORDER = [
        'shipments',
        'runs',
        'routes',
        'drivers',
        'vehicles',
        'locations',
        'location_types',
        'merchant_integrations',
        'webhooks',
        'api_call_logs',
        'idempotency_keys',
        'merchant_invites',
        'activity_logs',
        'vehicle_activity',
    ];

    private ?\Closure $batchProgress = null;

    public function __construct(private ActivityLogService $activityLogService) {}

    /** Queued purges commit completed types and activity batches independently. */
    public function purgeIncrementally(User $user, Merchant $merchant, array $types, callable $progress, callable $persist): array
    {
        $this->assertPreconditions($merchant, $types);
        $ordered = array_values(array_intersect(self::EXECUTION_ORDER, $types));
        $resources = $this->resourceIdsForMerchant($merchant);
        $result = ['merchant_uuid' => $merchant->uuid, 'requested_types' => $types, 'processed_types' => [], 'results' => []];
        try {
            foreach ($ordered as $type) {
                $done = count($result['processed_types']);
                $rows = 0;
                $this->batchProgress = function (int $deleted = 0) use ($progress, $done, $ordered, $type, &$rows) {
                    $rows += $deleted;
                    $progress($done, count($ordered), $type, $ordered, $rows);
                };
                ($this->batchProgress)();
                // Other types retain their dependency/file atomicity. The large
                // activity/GPS stage deliberately has no enclosing transaction.
                $delete = fn () => $this->purgeByType($merchant, $type, $resources);
                $result['results'][$type] = $type === 'vehicle_activity' ? $delete() : DB::transaction($delete, 3);
                $result['processed_types'][] = $type;
                $persist($result);
            }
            $progress(count($ordered), count($ordered), null, $ordered, 0);
            $this->activityLogService->log(
                action: 'purged', entityType: 'merchant_data', entity: $merchant,
                actor: $user, accountId: $merchant->account_id, merchantId: $merchant->id,
                title: 'Merchant data purged', metadata: $result,
            );

            return $result;
        } finally {
            $this->batchProgress = null;
        }
    }

    /** Select without write locks, then delete only a bounded set of primary keys. */
    private function deleteInBatches(Builder $query, string $key = 'id', ?callable $afterBatch = null): int
    {
        $deleted = 0;
        $upper = (clone $query)->max($key);
        if ($upper === null) {
            return 0;
        }
        (clone $query)->where($key, '<=', $upper)->select($key)->chunkById(250, function ($rows) use ($query, $key, &$deleted, $afterBatch) {
            $this->batchProgress && ($this->batchProgress)();
            $count = DB::transaction(fn () => (clone $query)->whereIn($key, $rows->pluck($key)->all())->delete(), 3);
            $deleted += $count;
            $afterBatch && $afterBatch();
            $this->batchProgress && ($this->batchProgress)($count);
        }, $key);

        return $deleted;
    }


    public static function allowedTypes(): array
    {
        return self::EXECUTION_ORDER;
    }

    public function purge(User $user, Merchant $merchant, array $types, ?callable $progress = null): array
    {
        $result = $this->purgeWithoutActivityLog($merchant, $types, $progress);

        $this->activityLogService->log(
            action: 'purged',
            entityType: 'merchant_data',
            entity: $merchant,
            actor: $user,
            accountId: $merchant->account_id,
            merchantId: $merchant->id,
            title: 'Merchant data purged',
            metadata: [
                'requested_types' => $result['requested_types'],
                'processed_types' => $result['processed_types'],
                'results' => $result['results'],
            ]
        );

        return $result;
    }

    public function purgeAllWithoutActivityLog(Merchant $merchant): array
    {
        return $this->purgeWithoutActivityLog($merchant, self::allowedTypes());
    }

    public function purgeWithoutActivityLog(Merchant $merchant, array $types, ?callable $progress = null): array
    {
        $requestedTypes = array_values(array_unique($types));
        $orderedTypes = array_values(array_intersect(self::EXECUTION_ORDER, $requestedTypes));

        $this->assertPreconditions($merchant, $requestedTypes);

        $results = DB::transaction(function () use ($merchant, $orderedTypes, $progress) {
            $resourceIds = $this->resourceIdsForMerchant($merchant);
            $results = [];
            foreach ($orderedTypes as $type) {
                $progress && $progress(count($results), count($orderedTypes), $type, $orderedTypes);
                $results[$type] = $this->purgeByType($merchant, $type, $resourceIds);
            }
            $progress && $progress(count($results), count($orderedTypes), null, $orderedTypes);

            return $results;
        }, attempts: 3);

        return [
            'merchant_uuid' => $merchant->uuid,
            'requested_types' => $requestedTypes,
            'processed_types' => $orderedTypes,
            'results' => $results,
        ];
    }

    private function assertPreconditions(Merchant $merchant, array $types): void
    {
        if (in_array('locations', $types, true) && ! in_array('shipments', $types, true)) {
            $hasShipments = DB::table('shipments')
                ->where('merchant_id', $merchant->id)
                ->exists();

            if ($hasShipments) {
                throw ValidationException::withMessages([
                    'types' => ['Cannot purge locations while shipments still exist. Include shipments or purge them first.'],
                ]);
            }
        }
    }

    private function purgeByType(Merchant $merchant, string $type, array $resourceIds): array
    {
        return match ($type) {
            'shipments' => $this->purgeShipments($merchant),
            'runs' => $this->purgeRuns($merchant),
            'vehicle_activity' => $this->purgeVehicleActivity($merchant),
            'routes' => $this->purgeRoutes($merchant),
            'drivers' => $this->purgeDrivers($merchant, $resourceIds['drivers']),
            'vehicles' => $this->purgeVehicles($merchant, $resourceIds['vehicles']),
            'locations' => $this->purgeLocations($merchant),
            'location_types' => $this->purgeLocationTypes($merchant),
            'merchant_integrations' => $this->purgeMerchantIntegrations($merchant),
            'webhooks' => $this->purgeWebhooks($merchant),
            'api_call_logs' => $this->purgeApiCallLogs($merchant),
            'idempotency_keys' => $this->purgeIdempotencyKeys($merchant),
            'merchant_invites' => $this->purgeMerchantInvites($merchant),
            'activity_logs' => $this->purgeActivityLogs($merchant),
            default => ['deleted_rows' => 0],
        };
    }

    private function purgeShipments(Merchant $merchant): array
    {
        $shipmentIds = DB::table('shipments')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();

        if (empty($shipmentIds)) {
            $deleted = $this->purgeStoredRows(DB::table('delivery_note_imports')->where('merchant_id', $merchant->id));

            return ['deleted_rows' => $deleted, 'tables' => ['delivery_note_imports' => $deleted]];
        }

        $quoteIds = DB::table('quotes')
            ->whereIn('shipment_id', $shipmentIds)
            ->pluck('id')
            ->all();

        $bookingIds = DB::table('bookings')
            ->whereIn('shipment_id', $shipmentIds)
            ->pluck('id')
            ->all();

        $tables = $this->purgeEntityFiles($merchant, Shipment::class, $shipmentIds);
        $tables['delivery_note_imports'] = $this->purgeStoredRows(DB::table('delivery_note_imports')->where('merchant_id', $merchant->id));
        $tables['tracking_events'] = $this->purgeShipmentTrackingEvents($shipmentIds);
        $tables['run_shipments'] = DB::table('run_shipments')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['booking_pods'] = empty($bookingIds) ? 0 : DB::table('booking_pods')->whereIn('booking_id', $bookingIds)->delete();
        $tables['bookings'] = DB::table('bookings')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['quote_options'] = empty($quoteIds) ? 0 : DB::table('quote_options')->whereIn('quote_id', $quoteIds)->delete();
        $tables['quotes'] = DB::table('quotes')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['shipment_parcels'] = DB::table('shipment_parcels')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['shipments'] = DB::table('shipments')->whereIn('id', $shipmentIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeShipmentTrackingEvents(array $shipmentIds): int
    {
        $deleted = 0;

        // Large secondary-index DELETE ranges can lock unrelated rows when MySQL
        // chooses a table scan. Read matching IDs, then delete bounded primary keys.
        foreach (array_chunk($shipmentIds, 250) as $shipmentBatch) {
            DB::table('tracking_events')
                ->whereIn('shipment_id', $shipmentBatch)
                ->select('id')
                ->chunkById(250, function ($events) use (&$deleted) {
                    $deleted += DB::table('tracking_events')
                        ->whereIn('id', $events->pluck('id')->all())
                        ->delete();
                });
        }

        return $deleted;
    }

    private function purgeRuns(Merchant $merchant): array
    {
        $runIds = DB::table('runs')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();

        if (empty($runIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = $this->purgeGpsHistory($merchant, DB::table('vehicle_location_history')->where('merchant_id', $merchant->id)->whereIn('run_id', $runIds));
        $tables['delivery_note_imports'] = $this->purgeStoredRows(DB::table('delivery_note_imports')->where('merchant_id', $merchant->id)->whereIn('run_id', $runIds));
        $tables['run_shipments'] = DB::table('run_shipments')->whereIn('run_id', $runIds)->delete();
        $tables['vehicle_activity'] = DB::table('vehicle_activity')->whereIn('run_id', $runIds)->delete();
        $tables['runs'] = DB::table('runs')->whereIn('id', $runIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeVehicleActivity(Merchant $merchant): array
    {
        $deleted = $this->deleteInBatches(DB::table('vehicle_activity')->where('merchant_id', $merchant->id));

        $tables = $this->purgeGpsHistory($merchant, DB::table('vehicle_location_history')->where('merchant_id', $merchant->id), true);
        $tables['vehicle_activity'] = $deleted;

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeRoutes(Merchant $merchant): array
    {
        $routeIds = DB::table('routes')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();

        if (empty($routeIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = [];
        $tables['route_stops'] = DB::table('route_stops')->whereIn('route_id', $routeIds)->delete();
        $tables['routes'] = DB::table('routes')->whereIn('id', $routeIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeDrivers(Merchant $merchant, array $driverIds): array
    {
        if (empty($driverIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $protectedDriverIds = $this->protectedDriverIds($merchant, $driverIds);

        if (! empty($protectedDriverIds)) {
            $driverIds = array_values(array_diff($driverIds, $protectedDriverIds));
        }

        if (empty($driverIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = $this->purgeEntityFiles($merchant, Driver::class, $driverIds);
        $tables['driver_assignments'] = DB::table('driver_assignments')->whereIn('driver_id', $driverIds)->delete();
        $tables['driver_vehicles'] = DB::table('driver_vehicles')->whereIn('driver_id', $driverIds)->delete();
        $tables['drivers'] = DB::table('drivers')->whereIn('id', $driverIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeVehicles(Merchant $merchant, array $vehicleIds): array
    {
        if (empty($vehicleIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $protectedVehicleIds = $this->protectedVehicleIds($merchant, $vehicleIds);

        if (! empty($protectedVehicleIds)) {
            $vehicleIds = array_values(array_diff($vehicleIds, $protectedVehicleIds));
        }

        if (empty($vehicleIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = $this->purgeEntityFiles($merchant, Vehicle::class, $vehicleIds);
        $tables += $this->purgeGpsHistory($merchant, DB::table('vehicle_location_history')->where('merchant_id', $merchant->id)->whereIn('vehicle_id', $vehicleIds));
        $tables['vehicle_location_receipts'] += DB::table('vehicle_location_receipts')->whereIn('vehicle_id', $vehicleIds)->delete();
        $tables['driver_vehicles'] = DB::table('driver_vehicles')->whereIn('vehicle_id', $vehicleIds)->delete();
        $tables['vehicle_activity'] = DB::table('vehicle_activity')->whereIn('vehicle_id', $vehicleIds)->delete();
        $tables['vehicles'] = DB::table('vehicles')->whereIn('id', $vehicleIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeLocations(Merchant $merchant): array
    {
        $locationIds = DB::table('locations')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();

        if (empty($locationIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = [];
        $tables['route_stops'] = DB::table('route_stops')->whereIn('location_id', $locationIds)->delete();
        $tables['vehicle_activity'] = DB::table('vehicle_activity')->whereIn('location_id', $locationIds)->delete();
        $tables['locations'] = DB::table('locations')->whereIn('id', $locationIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeLocationTypes(Merchant $merchant): array
    {
        $deleted = DB::table('location_types')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['location_types' => $deleted]];
    }

    private function purgeMerchantIntegrations(Merchant $merchant): array
    {
        $deleted = DB::table('merchant_integrations')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['merchant_integrations' => $deleted]];
    }

    private function purgeWebhooks(Merchant $merchant): array
    {
        $subscriptionIds = DB::table('webhook_subscriptions')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();

        $tables = [];
        $tables['webhook_deliveries'] = empty($subscriptionIds)
            ? 0
            : DB::table('webhook_deliveries')->whereIn('webhook_subscription_id', $subscriptionIds)->delete();
        $tables['webhook_subscriptions'] = DB::table('webhook_subscriptions')->where('merchant_id', $merchant->id)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeApiCallLogs(Merchant $merchant): array
    {
        $deleted = DB::table('api_calls_logs')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['api_calls_logs' => $deleted]];
    }

    private function purgeIdempotencyKeys(Merchant $merchant): array
    {
        $deleted = DB::table('idempotency_keys')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['idempotency_keys' => $deleted]];
    }

    private function purgeMerchantInvites(Merchant $merchant): array
    {
        $deleted = DB::table('merchant_invites')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['merchant_invites' => $deleted]];
    }

    private function purgeActivityLogs(Merchant $merchant): array
    {
        $deleted = DB::table('activity_logs')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['activity_logs' => $deleted]];
    }

    private function purgeEntityFiles(Merchant $merchant, string $model, array $ids): array
    {
        $deleted = $this->purgeStoredRows(DB::table('entity_files')
            ->where('merchant_id', $merchant->id)
            ->where('attachable_type', $model)
            ->whereIn('attachable_id', $ids));

        return ['entity_files' => $deleted];
    }

    private function purgeStoredRows(Builder $query): int
    {
        $deleted = 0;
        (clone $query)->select(['id', 'disk', 'path'])->chunkById(250, function ($rows) use ($query, &$deleted) {
            $files = $rows->map(fn ($row) => ['disk' => $row->disk, 'path' => $row->path])->all();
            $deleted += (clone $query)->whereIn('id', $rows->pluck('id')->all())->delete();
            DeleteMerchantFilesJob::dispatch($files)->afterCommit();
        });

        return $deleted;
    }

    /** Walk the vehicle/time index once; only evaluate ownership for a bounded batch. */
    private function deleteGpsReceipts(Builder $eligible, int $vehicleId, ?string $from = null, ?string $until = null): int
    {
        $scan = DB::table('vehicle_location_receipts')->where('vehicle_id', $vehicleId);
        if ($from !== null) {
            $scan->where('observed_at', '>=', $from);
        }
        $until ??= (clone $scan)->max('observed_at');
        if ($until === null) {
            return 0;
        }
        $scan->where('observed_at', '<=', $until);
        $lastTime = null;
        $lastKey = null;
        $deleted = 0;
        do {
            $this->batchProgress && ($this->batchProgress)();
            $page = clone $scan;
            if ($lastTime !== null) {
                $page->where(function (Builder $query) use ($lastTime, $lastKey) {
                    $query->where('observed_at', '>', $lastTime)
                        ->orWhere(fn (Builder $sameTime) => $sameTime->where('observed_at', $lastTime)->where('sample_key', '>', $lastKey));
                });
            }
            $rows = $page->orderBy('observed_at')->orderBy('sample_key')->limit(250)->get(['sample_key', 'observed_at']);
            if ($rows->isEmpty()) {
                break;
            }
            // Keep eligibility predicates on the DELETE too: shared history may
            // have changed since the unlocked candidate read.
            $count = DB::transaction(fn () => (clone $eligible)
                ->whereIn('sample_key', $rows->pluck('sample_key')->all())->delete(), 3);
            $deleted += $count;
            $lastTime = $rows->last()->observed_at;
            $lastKey = $rows->last()->sample_key;
            $this->batchProgress && ($this->batchProgress)($count);
        } while ($rows->count() === 250);

        return $deleted;
    }

    private function purgeGpsHistory(Merchant $merchant, Builder $history, bool $allMerchantHistory = false): array
    {
        $runIds = (clone $history)->whereNotNull('run_id')->distinct()->pluck('run_id')->all();
        // Receipts include merged stationary samples, not just first_sample_key.
        // Keep ambiguous receipts if retained history covers the same vehicle/time.
        $receipts = 0;
        // Start from selected vehicles, never a DELETE scanning every receipt.
        $vehicleIds = (clone $history)->distinct()->pluck('vehicle_id')->all();
        foreach ($vehicleIds as $vehicleId) {
            $selected = (clone $history)->where('vehicle_id', $vehicleId);
            $retained = DB::table('vehicle_location_history')->where('vehicle_id', $vehicleId);
            if ($allMerchantHistory) {
                $retained->where('merchant_id', '!=', $merchant->id);
            } else {
                $retained->whereNotIn('id', (clone $selected)->select('id'));
            }
            // For an exclusively owned vehicle, a full activity purge needs no
            // interval matching at all. Recheck retained history on each DELETE.
            if ($allMerchantHistory
                && DB::table('vehicles')->where('id', $vehicleId)->where('merchant_id', $merchant->id)->exists()
                && ! (clone $retained)->exists()) {
                $receipts += $this->deleteGpsReceipts(
                    DB::table('vehicle_location_receipts')->where('vehicle_id', $vehicleId)
                        ->whereNotExists((clone $retained)->selectRaw('1')),
                    $vehicleId,
                );

                continue;
            }
            $from = (clone $selected)->min('observed_at');
            $until = (clone $selected)->max('last_seen_at');
            $receiptQuery = DB::table('vehicle_location_receipts')->where('vehicle_id', $vehicleId)
                ->whereBetween('observed_at', [$from, $until])
                ->whereExists((clone $selected)->selectRaw('1')
                    ->whereColumn('vehicle_location_history.observed_at', '<=', 'vehicle_location_receipts.observed_at')
                    ->whereColumn('vehicle_location_history.last_seen_at', '>=', 'vehicle_location_receipts.observed_at'))
                ->whereNotExists((clone $retained)->selectRaw('1')
                    ->whereColumn('vehicle_location_history.observed_at', '<=', 'vehicle_location_receipts.observed_at')
                    ->whereColumn('vehicle_location_history.last_seen_at', '>=', 'vehicle_location_receipts.observed_at'));
            $receipts += $this->deleteGpsReceipts($receiptQuery, $vehicleId, $from, $until);
        }
        $deleted = $this->deleteInBatches($history, 'id', function () use ($runIds) {
            foreach ($runIds as $runId) {
                DB::afterCommit(fn () => Cache::put('run-track-version:'.$runId, (string) Str::uuid(), now()->addYears(10)));
            }
        });
        if ($allMerchantHistory) {
            $ownedVehicleIds = DB::table('vehicles')->where('merchant_id', $merchant->id)->pluck('id');
            foreach ($ownedVehicleIds as $vehicleId) {
                if (! DB::table('vehicle_location_history')->where('vehicle_id', $vehicleId)->exists()) {
                    $receipts += $this->deleteGpsReceipts(DB::table('vehicle_location_receipts')
                        ->where('vehicle_id', $vehicleId)
                        ->whereNotExists(DB::table('vehicle_location_history')->selectRaw('1')->where('vehicle_id', $vehicleId)), $vehicleId);
                }
            }
        }
        foreach ($runIds as $runId) {
            DB::afterCommit(fn () => Cache::put('run-track-version:'.$runId, (string) Str::uuid(), now()->addYears(10)));
        }

        return ['vehicle_location_history' => $deleted, 'vehicle_location_receipts' => $receipts];
    }

    private function resourceIdsForMerchant(Merchant $merchant): array
    {
        $merchantDriverIds = DB::table('drivers')
            ->where('drivers.merchant_id', $merchant->id)
            ->pluck('drivers.id')
            ->all();
        $carrierDriverIds = DB::table('drivers')
            ->join('carriers', 'carriers.id', '=', 'drivers.carrier_id')
            ->where('carriers.merchant_id', $merchant->id)
            ->pluck('drivers.id')
            ->all();
        $runDriverIds = DB::table('runs')
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('driver_id')
            ->pluck('driver_id')
            ->all();

        $driverIds = array_values(array_unique(array_merge(
            $merchantDriverIds,
            $carrierDriverIds,
            $runDriverIds,
        )));

        $merchantVehicleIds = DB::table('vehicles')
            ->where('merchant_id', $merchant->id)
            ->pluck('id')
            ->all();
        $runVehicleIds = DB::table('runs')
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('vehicle_id')
            ->pluck('vehicle_id')
            ->all();
        $driverVehicleIds = empty($driverIds)
            ? []
            : DB::table('driver_vehicles')
                ->whereIn('driver_id', $driverIds)
                ->whereNotNull('vehicle_id')
                ->pluck('vehicle_id')
                ->all();

        return [
            'drivers' => $driverIds,
            'vehicles' => array_values(array_unique(array_merge(
                $merchantVehicleIds,
                $runVehicleIds,
                $driverVehicleIds,
            ))),
        ];
    }

    private function protectedDriverIds(Merchant $merchant, array $driverIds): array
    {
        $fileIds = DB::table('entity_files')->where('attachable_type', Driver::class)
            ->whereIn('attachable_id', $driverIds)->where('merchant_id', '!=', $merchant->id)->pluck('attachable_id')->all();
        $runIds = DB::table('runs')
            ->whereIn('driver_id', $driverIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('driver_id')
            ->all();
        $bookingIds = DB::table('bookings')
            ->join('shipments', 'shipments.id', '=', 'bookings.shipment_id')
            ->whereIn('bookings.current_driver_id', $driverIds)
            ->where('shipments.merchant_id', '!=', $merchant->id)
            ->pluck('bookings.current_driver_id')
            ->all();
        $offerIds = DB::table('delivery_offers')
            ->whereIn('driver_id', $driverIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('driver_id')
            ->all();
        $otherOwnedIds = DB::table('drivers')
            ->whereIn('id', $driverIds)
            ->whereNotNull('merchant_id')
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('id')
            ->all();

        return array_values(array_unique(array_merge($fileIds, $runIds, $bookingIds, $offerIds, $otherOwnedIds)));
    }

    private function protectedVehicleIds(Merchant $merchant, array $vehicleIds): array
    {
        $historyIds = DB::table('vehicle_location_history')->whereIn('vehicle_id', $vehicleIds)
            ->where('merchant_id', '!=', $merchant->id)->pluck('vehicle_id')->all();
        $fileIds = DB::table('entity_files')->where('attachable_type', Vehicle::class)
            ->whereIn('attachable_id', $vehicleIds)->where('merchant_id', '!=', $merchant->id)->pluck('attachable_id')->all();
        $runIds = DB::table('runs')
            ->whereIn('vehicle_id', $vehicleIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('vehicle_id')
            ->all();
        $activityIds = DB::table('vehicle_activity')
            ->whereIn('vehicle_id', $vehicleIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('vehicle_id')
            ->all();
        $otherDriverIds = DB::table('driver_vehicles')
            ->join('drivers', 'drivers.id', '=', 'driver_vehicles.driver_id')
            ->whereIn('driver_vehicles.vehicle_id', $vehicleIds)
            ->whereNotNull('drivers.merchant_id')
            ->where('drivers.merchant_id', '!=', $merchant->id)
            ->pluck('driver_vehicles.vehicle_id')
            ->all();
        $linkedDriverIds = DB::table('driver_vehicles')
            ->whereIn('vehicle_id', $vehicleIds)
            ->pluck('driver_id')
            ->all();
        $protectedLinkedDriverIds = empty($linkedDriverIds)
            ? []
            : $this->protectedDriverIds($merchant, $linkedDriverIds);
        $protectedLinkedVehicleIds = empty($protectedLinkedDriverIds)
            ? []
            : DB::table('driver_vehicles')
                ->whereIn('driver_id', $protectedLinkedDriverIds)
                ->whereIn('vehicle_id', $vehicleIds)
                ->pluck('vehicle_id')
                ->all();
        $otherOwnedIds = DB::table('vehicles')
            ->whereIn('id', $vehicleIds)
            ->whereNotNull('merchant_id')
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('id')
            ->all();

        return array_values(array_unique(array_merge(
            $historyIds,
            $fileIds,
            $runIds,
            $activityIds,
            $otherDriverIds,
            $protectedLinkedVehicleIds,
            $otherOwnedIds,
        )));
    }
}
