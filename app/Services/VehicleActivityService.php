<?php

namespace App\Services;

use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Support\MerchantAccess;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class VehicleActivityService
{
    public function listActivities(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->scopedQuery($user)
            ->with(['merchant', 'vehicle.lastDriver.user', 'location.locationType', 'run.driver.user', 'shipment.pickupLocation', 'shipment.dropoffLocation', 'shipment.booking'])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if (! empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()->where('uuid', $filters['merchant_id'])->value('id');
            $query->where('merchant_id', $merchantId ?? 0);
        }

        if (! empty($filters['vehicle_id'])) {
            $vehicleId = Vehicle::query()->where('uuid', $filters['vehicle_id'])->value('id');
            $query->where('vehicle_id', $vehicleId ?? 0);
        }

        if (! empty($filters['plate_number'])) {
            $query->whereHas('vehicle', function (Builder $builder) use ($filters) {
                $builder->where('plate_number', 'like', '%'.$filters['plate_number'].'%');
            });
        }

        if (! empty($filters['location_id'])) {
            $locationId = Location::query()->where('uuid', $filters['location_id'])->value('id');
            $query->where('location_id', $locationId ?? 0);
        }

        if (! empty($filters['location_type_id'])) {
            $locationTypeId = LocationType::query()->where('uuid', $filters['location_type_id'])->value('id');
            $query->whereHas('location', function (Builder $builder) use ($locationTypeId) {
                $builder->where('location_type_id', $locationTypeId ?? 0);
            });
        }

        if (! empty($filters['shipment_id'])) {
            $shipmentId = Shipment::query()->where('uuid', $filters['shipment_id'])->value('id');
            $query->where('shipment_id', $shipmentId ?? 0);
        }

        if (! empty($filters['event_type'])) {
            $query->where('event_type', $filters['event_type']);
        }

        if (! empty($filters['from'])) {
            $query->whereDate('occurred_at', '>=', $filters['from']);
        }

        if (! empty($filters['to'])) {
            $query->whereDate('occurred_at', '<=', $filters['to']);
        }

        if (! empty($filters['occurred_from'])) {
            $query->where('occurred_at', '>=', \Illuminate\Support\Carbon::parse($filters['occurred_from'])->utc());
        }

        if (! empty($filters['occurred_to'])) {
            $query->where('occurred_at', '<=', \Illuminate\Support\Carbon::parse($filters['occurred_to'])->utc());
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $query->paginate($perPage);
    }

    public function listVehiclesWithLatestActivity(User $user, array $filters): Collection
    {
        $merchant = $this->resolveMerchantForVehicleListing($user, $filters['merchant_id']);
        if (! $merchant) {
            return new Collection;
        }

        $vehicles = $this->monitoringVehicleQuery($merchant)->get();

        if ($vehicles->isEmpty()) {
            return $vehicles;
        }

        $activities = VehicleActivity::query()
            ->whereIn('id', $vehicles->pluck('latest_activity_id')->filter())
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment.pickupLocation', 'shipment.dropoffLocation', 'shipment.booking'])
            ->get()
            ->keyBy('vehicle_id');

        // Each event type uses its own indexed seek. Only two candidates per
        // vehicle need comparison, including deterministic timestamp ties.
        $transitionIds = $vehicles->pluck('latest_entry_id')
            ->merge($vehicles->pluck('latest_exit_id'))->filter()->unique();
        $monitoringActivities = VehicleActivity::query()
            ->whereIn('id', $transitionIds)
            ->with('location.locationType')
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->get()
            ->unique('vehicle_id')
            ->keyBy('vehicle_id');

        $vehicles->each(function (Vehicle $vehicle) use ($activities, $monitoringActivities, $merchant) {
            $vehicle->setRelation('resolvedMerchant', $merchant);
            $vehicle->setRelation('latestVehicleActivity', $activities->get($vehicle->id));
            $vehicle->setRelation('latestMonitoringActivity', $monitoringActivities->get($vehicle->id));
        });

        return $vehicles;
    }

    /** Internal query factory shared with the read-only query-plan diagnostic.
     * Merchant authorization is performed by listVehiclesWithLatestActivity.
     */
    public function monitoringVehicleQuery(Merchant $merchant, bool $useIndexHints = true): Builder
    {
        // Constrain the access path: an ordered PRIMARY/occurred_at scan can
        // inspect unrelated history for every vehicle, especially absent events.
        $latestActivity = function (?string $eventType = null) use ($merchant, $useIndexHints) {
            $query = VehicleActivity::query()
                ->select('id')
                ->where('merchant_id', $merchant->id)
                ->whereColumn('vehicle_id', 'vehicles.id')
                ->whereNotNull('occurred_at')
                ->orderByDesc('occurred_at')
                ->orderByDesc('id')
                ->limit(1);
            if ($eventType !== null) {
                $query->where('event_type', $eventType);
            }
            if ($useIndexHints && in_array($query->getConnection()->getDriverName(), ['mysql', 'mariadb'], true)) {
                $query->forceIndex($eventType === null ? 'va_monitoring_latest' : 'va_monitoring_transition');
            }

            return $query;
        };

        return Vehicle::query()
            ->select('vehicles.*')
            ->addSelect([
                'latest_activity_id' => $latestActivity(),
                'latest_entry_id' => $latestActivity(VehicleActivity::EVENT_ENTERED_LOCATION),
                'latest_exit_id' => $latestActivity(VehicleActivity::EVENT_EXITED_LOCATION),
            ])
            ->with(['lastDriver.user'])
            ->withExists([
                'activeRuns as qualifying_active_runs_count' => function (Builder $query) {
                    $query->whereHas('runShipments', function (Builder $runShipmentQuery) {
                        $runShipmentQuery
                            ->where('status', '!=', RunShipment::STATUS_REMOVED)
                            ->whereHas('shipment', function (Builder $shipmentQuery) {
                                $shipmentQuery->whereNotIn('status', ['delivered', 'cancelled']);
                            });
                    });
                },
            ])
            ->where('merchant_id', $merchant->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id');

    }

    public function getActivity(User $user, string $activityUuid): VehicleActivity
    {
        $activity = $this->scopedQuery($user)
            ->with(['merchant', 'vehicle.lastDriver.user', 'location.locationType', 'run.driver.user', 'shipment.pickupLocation', 'shipment.dropoffLocation', 'shipment.booking'])
            ->where('uuid', $activityUuid)
            ->first();

        if (! $activity) {
            throw new ModelNotFoundException('Vehicle activity not found.');
        }

        return $activity;
    }

    private function scopedQuery(User $user): Builder
    {
        $query = VehicleActivity::query();

        if ($user->role === 'super_admin') {
            return $query;
        }

        return MerchantAccess::scopeToMerchants($query, $user);
    }

    private function resolveMerchantForVehicleListing(User $user, string $merchantUuid): ?Merchant
    {
        $merchant = Merchant::query()->where('uuid', $merchantUuid)->first();
        if (! $merchant) {
            return null;
        }

        if ($user->role === 'super_admin') {
            return $merchant;
        }

        return MerchantAccess::hasMerchantAccess($user, $merchant) ? $merchant : null;
    }
}
