<?php

namespace App\Services;

use App\Models\Location;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Support\MerchantAccess;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;

class VehicleActivityService
{
    public function listActivities(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->scopedQuery($user)
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment'])
            ->orderByDesc('occurred_at')
            ->orderByDesc('id');

        if (!empty($filters['merchant_id'])) {
            $merchantId = Merchant::query()->where('uuid', $filters['merchant_id'])->value('id');
            $query->where('merchant_id', $merchantId ?? 0);
        }

        if (!empty($filters['vehicle_id'])) {
            $vehicleId = Vehicle::query()->where('uuid', $filters['vehicle_id'])->value('id');
            $query->where('vehicle_id', $vehicleId ?? 0);
        }

        if (!empty($filters['plate_number'])) {
            $query->whereHas('vehicle', function (Builder $builder) use ($filters) {
                $builder->where('plate_number', 'like', '%' . $filters['plate_number'] . '%');
            });
        }

        if (!empty($filters['location_id'])) {
            $locationId = Location::query()->where('uuid', $filters['location_id'])->value('id');
            $query->where('location_id', $locationId ?? 0);
        }

        if (!empty($filters['shipment_id'])) {
            $shipmentId = Shipment::query()->where('uuid', $filters['shipment_id'])->value('id');
            $query->where('shipment_id', $shipmentId ?? 0);
        }

        if (!empty($filters['event_type'])) {
            $query->where('event_type', $filters['event_type']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('occurred_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('occurred_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 20), 100);

        return $query->paginate($perPage);
    }

    public function listVehiclesWithLatestActivity(User $user, array $filters): Collection
    {
        $merchant = $this->resolveMerchantForVehicleListing($user, $filters['merchant_id']);
        if (!$merchant) {
            return new Collection();
        }

        $vehicles = Vehicle::query()
            ->with(['lastDriver.user'])
            ->where('merchant_id', $merchant->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->get();

        if ($vehicles->isEmpty()) {
            return $vehicles;
        }

        $vehicleIds = $vehicles->pluck('id');

        $latestOccurredAtSub = VehicleActivity::query()
            ->selectRaw('vehicle_id, MAX(occurred_at) as latest_occurred_at')
            ->where('merchant_id', $merchant->id)
            ->whereIn('vehicle_id', $vehicleIds)
            ->groupBy('vehicle_id')
            ->toBase();

        $latestActivityIdSub = VehicleActivity::query()
            ->from('vehicle_activity as latest_vehicle_activity_candidates')
            ->selectRaw('latest_vehicle_activity_candidates.vehicle_id, MAX(latest_vehicle_activity_candidates.id) as latest_activity_id')
            ->joinSub($latestOccurredAtSub, 'latest_vehicle_activity_occurred_at', function ($join) {
                $join->on('latest_vehicle_activity_occurred_at.vehicle_id', '=', 'latest_vehicle_activity_candidates.vehicle_id')
                    ->on('latest_vehicle_activity_occurred_at.latest_occurred_at', '=', 'latest_vehicle_activity_candidates.occurred_at');
            })
            ->groupBy('latest_vehicle_activity_candidates.vehicle_id')
            ->toBase();

        $activities = VehicleActivity::query()
            ->select('vehicle_activity.*')
            ->joinSub($latestActivityIdSub, 'latest_vehicle_activity', function ($join) {
                $join->on('latest_vehicle_activity.latest_activity_id', '=', 'vehicle_activity.id');
            })
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment'])
            ->get()
            ->keyBy('vehicle_id');

        $vehicles->each(function (Vehicle $vehicle) use ($activities, $merchant) {
            $vehicle->setRelation('resolvedMerchant', $merchant);
            $vehicle->setRelation('latestVehicleActivity', $activities->get($vehicle->id));
        });

        return $vehicles;
    }

    public function getActivity(User $user, string $activityUuid): VehicleActivity
    {
        $activity = $this->scopedQuery($user)
            ->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment'])
            ->where('uuid', $activityUuid)
            ->first();

        if (!$activity) {
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
        if (!$merchant) {
            return null;
        }

        if ($user->role === 'super_admin') {
            return $merchant;
        }

        return MerchantAccess::hasMerchantAccess($user, $merchant) ? $merchant : null;
    }
}
