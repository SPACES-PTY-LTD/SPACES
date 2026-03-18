<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class DataPurgeService
{
    private const EXECUTION_ORDER = [
        'shipments',
        'runs',
        'vehicle_activity',
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
    ];

    public function __construct(private ActivityLogService $activityLogService)
    {
    }

    public static function allowedTypes(): array
    {
        return self::EXECUTION_ORDER;
    }

    public function purge(User $user, Merchant $merchant, array $types): array
    {
        $requestedTypes = array_values(array_unique($types));
        $orderedTypes = array_values(array_intersect(self::EXECUTION_ORDER, $requestedTypes));

        $this->assertPreconditions($merchant, $requestedTypes);

        $results = DB::transaction(function () use ($merchant, $orderedTypes) {
            $results = [];
            foreach ($orderedTypes as $type) {
                $results[$type] = $this->purgeByType($merchant, $type);
            }

            return $results;
        });

        $this->activityLogService->log(
            action: 'purged',
            entityType: 'merchant_data',
            entity: $merchant,
            actor: $user,
            accountId: $merchant->account_id,
            merchantId: $merchant->id,
            title: 'Merchant data purged',
            metadata: [
                'requested_types' => $requestedTypes,
                'processed_types' => $orderedTypes,
                'results' => $results,
            ]
        );

        return [
            'merchant_uuid' => $merchant->uuid,
            'requested_types' => $requestedTypes,
            'processed_types' => $orderedTypes,
            'results' => $results,
        ];
    }

    private function assertPreconditions(Merchant $merchant, array $types): void
    {
        if (in_array('locations', $types, true) && !in_array('shipments', $types, true)) {
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

    private function purgeByType(Merchant $merchant, string $type): array
    {
        return match ($type) {
            'shipments' => $this->purgeShipments($merchant),
            'runs' => $this->purgeRuns($merchant),
            'vehicle_activity' => $this->purgeVehicleActivity($merchant),
            'routes' => $this->purgeRoutes($merchant),
            'drivers' => $this->purgeDrivers($merchant),
            'vehicles' => $this->purgeVehicles($merchant),
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
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $quoteIds = DB::table('quotes')
            ->whereIn('shipment_id', $shipmentIds)
            ->pluck('id')
            ->all();

        $bookingIds = DB::table('bookings')
            ->whereIn('shipment_id', $shipmentIds)
            ->pluck('id')
            ->all();

        $tables = [];
        $tables['tracking_events'] = DB::table('tracking_events')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['run_shipments'] = DB::table('run_shipments')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['booking_pods'] = empty($bookingIds) ? 0 : DB::table('booking_pods')->whereIn('booking_id', $bookingIds)->delete();
        $tables['bookings'] = DB::table('bookings')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['quote_options'] = empty($quoteIds) ? 0 : DB::table('quote_options')->whereIn('quote_id', $quoteIds)->delete();
        $tables['quotes'] = DB::table('quotes')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['shipment_parcels'] = DB::table('shipment_parcels')->whereIn('shipment_id', $shipmentIds)->delete();
        $tables['shipments'] = DB::table('shipments')->whereIn('id', $shipmentIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
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

        $tables = [];
        $tables['run_shipments'] = DB::table('run_shipments')->whereIn('run_id', $runIds)->delete();
        $tables['vehicle_activity'] = DB::table('vehicle_activity')->whereIn('run_id', $runIds)->delete();
        $tables['runs'] = DB::table('runs')->whereIn('id', $runIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeVehicleActivity(Merchant $merchant): array
    {
        $deleted = DB::table('vehicle_activity')
            ->where('merchant_id', $merchant->id)
            ->delete();

        return ['deleted_rows' => $deleted, 'tables' => ['vehicle_activity' => $deleted]];
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

    private function purgeDrivers(Merchant $merchant): array
    {
        $merchantDriverIds = DB::table('drivers')
            ->where('drivers.merchant_id', $merchant->id)
            ->pluck('drivers.id')
            ->all();

        $carrierDriverIds = DB::table('drivers')
            ->join('carriers', 'carriers.id', '=', 'drivers.carrier_id')
            ->whereNull('drivers.merchant_id')
            ->where('carriers.merchant_id', $merchant->id)
            ->pluck('drivers.id')
            ->all();

        $runDriverIds = DB::table('runs')
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('driver_id')
            ->pluck('driver_id')
            ->all();

        $driverIds = array_values(array_unique(array_merge($merchantDriverIds, $carrierDriverIds, $runDriverIds)));
        if (empty($driverIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $protectedDriverIds = DB::table('runs')
            ->whereIn('driver_id', $driverIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('driver_id')
            ->all();

        if (!empty($protectedDriverIds)) {
            $driverIds = array_values(array_diff($driverIds, $protectedDriverIds));
        }

        if (empty($driverIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = [];
        $tables['driver_assignments'] = DB::table('driver_assignments')->whereIn('driver_id', $driverIds)->delete();
        $tables['driver_vehicles'] = DB::table('driver_vehicles')->whereIn('driver_id', $driverIds)->delete();
        $tables['drivers'] = DB::table('drivers')->whereIn('id', $driverIds)->delete();

        return ['deleted_rows' => array_sum($tables), 'tables' => $tables];
    }

    private function purgeVehicles(Merchant $merchant): array
    {
        $runVehicleIds = DB::table('runs')
            ->where('merchant_id', $merchant->id)
            ->whereNotNull('vehicle_id')
            ->pluck('vehicle_id')
            ->all();

        $driverVehicleIds = DB::table('driver_vehicles')
            ->join('drivers', 'drivers.id', '=', 'driver_vehicles.driver_id')
            ->join('carriers', 'carriers.id', '=', 'drivers.carrier_id')
            ->where('carriers.merchant_id', $merchant->id)
            ->pluck('driver_vehicles.vehicle_id')
            ->all();

        $vehicleIds = array_values(array_unique(array_merge($runVehicleIds, $driverVehicleIds)));
        if (empty($vehicleIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $protectedVehicleIds = DB::table('runs')
            ->whereIn('vehicle_id', $vehicleIds)
            ->where('merchant_id', '!=', $merchant->id)
            ->pluck('vehicle_id')
            ->all();

        if (!empty($protectedVehicleIds)) {
            $vehicleIds = array_values(array_diff($vehicleIds, $protectedVehicleIds));
        }

        if (empty($vehicleIds)) {
            return ['deleted_rows' => 0, 'tables' => []];
        }

        $tables = [];
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
}
