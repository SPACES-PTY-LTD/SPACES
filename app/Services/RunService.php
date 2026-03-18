<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\DeliveryRoute;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;

class RunService
{
    public function __construct(
        private readonly DriverVehicleService $driverVehicleService,
        private readonly InternalBookingLifecycleService $internalBookingLifecycleService,
    ) {}

    public function listRuns(User $user, array $filters, ?MerchantEnvironment $environment = null): LengthAwarePaginator
    {
        $query = Run::query()
            ->with([
                'merchant',
                'environment',
                'driver.user',
                'vehicle',
                'latestLocationStop.location',
                'vehicleActivities.merchant',
                'vehicleActivities.vehicle.lastDriver.user',
                'vehicleActivities.location',
                'vehicleActivities.run.driver.user',
                'vehicleActivities.shipment',
                'route.routeStops.location',
                'originLocation',
                'destinationLocation',
                'runShipments.shipment.parcels',
            ]);

        if ($environment) {
            $query->where('merchant_id', $environment->merchant_id)
                ->where('environment_id', $environment->id);
        } elseif ($user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        }

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if ($merchantUuid) {
            $merchantId = Merchant::where('uuid', $merchantUuid)->value('id');
            if ($merchantId) {
                $query->where('merchant_id', $merchantId);
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        $driverUuid = $filters['driver_uuid'] ?? $filters['driver_id'] ?? null;
        if ($driverUuid) {
            $driverId = Driver::where('uuid', $driverUuid)->value('id');
            $query->where('driver_id', $driverId ?? 0);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['date'])) {
            $query->whereDate('planned_start_at', $filters['date']);
        }

        if (!empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->where('uuid', 'like', '%' . $search . '%')
                    ->orWhere('status', 'like', '%' . $search . '%')
                    ->orWhere('service_area', 'like', '%' . $search . '%')
                    ->orWhere('notes', 'like', '%' . $search . '%')
                    ->orWhereHas('driver.user', function (Builder $driverBuilder) use ($search) {
                        $driverBuilder
                            ->where('name', 'like', '%' . $search . '%')
                            ->orWhere('email', 'like', '%' . $search . '%');
                    })
                    ->orWhereHas('vehicle', function (Builder $vehicleBuilder) use ($search) {
                        $vehicleBuilder
                            ->where('plate_number', 'like', '%' . $search . '%')
                            ->orWhere('ref_code', 'like', '%' . $search . '%');
                    });
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function createRun(array $data, ?MerchantEnvironment $environment = null): Run
    {
        return DB::transaction(function () use ($data, $environment) {
            $merchant = $this->resolveMerchant($data, $environment);
            $environmentModel = $this->resolveEnvironment($merchant, $data, $environment);

            $run = Run::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $environmentModel?->id,
                'driver_id' => $this->resolveDriverId($merchant, $data['driver_id'] ?? $data['driver_uuid'] ?? null),
                'vehicle_id' => $this->resolveVehicleId($merchant, $data['vehicle_id'] ?? $data['vehicle_uuid'] ?? null),
                'route_id' => $this->resolveRouteId($merchant, $data['route_id'] ?? $data['route_uuid'] ?? null),
                'status' => Run::STATUS_DRAFT,
                'planned_start_at' => $data['planned_start_at'] ?? null,
                'service_area' => $data['service_area'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->syncDriverVehicleAssignment($run);

            return $this->loadRun($run);
        });
    }

    public function assignShipmentDriver(Shipment $shipment, array $data): array
    {
        return DB::transaction(function () use ($shipment, $data) {
            $shipment->loadMissing(['merchant', 'environment', 'currentRunShipment.run']);

            $run = $shipment->currentRunShipment?->run;
            $created = false;

            if ($run) {
                $run = $this->updateRun($run, $data);
            } else {
                $run = $this->createRun([
                    'merchant_id' => $shipment->merchant->uuid,
                    'environment_id' => $shipment->environment?->uuid,
                    'driver_id' => $data['driver_id'],
                    'vehicle_id' => $data['vehicle_id'] ?? null,
                ], $shipment->environment);

                $run = $this->attachShipments($run, [$shipment->uuid]);
                $created = true;
            }

            $shipment = Shipment::query()
                ->whereKey($shipment->id)
                ->with('currentRunShipment.run')
                ->firstOrFail();

            return [$shipment, $created];
        });
    }

    public function getRunForUser(User $user, string $runUuid, ?MerchantEnvironment $environment = null): Run
    {
        $query = Run::query()->where('uuid', $runUuid);

        if ($environment) {
            $query->where('merchant_id', $environment->merchant_id)
                ->where('environment_id', $environment->id);
        } elseif ($user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        }

        $run = $query->firstOrFail();

        return $this->loadRun($run);
    }

    public function updateRun(Run $run, array $data): Run
    {
        if (!$run->isMutable()) {
            throw new ConflictHttpException('Run can only be edited while in draft or dispatched status.');
        }

        if (array_key_exists('driver_id', $data) || array_key_exists('driver_uuid', $data)) {
            $run->driver_id = $this->resolveDriverId($run->merchant, $data['driver_id'] ?? $data['driver_uuid'] ?? null);
        }

        if (array_key_exists('vehicle_id', $data) || array_key_exists('vehicle_uuid', $data)) {
            $run->vehicle_id = $this->resolveVehicleId($run->merchant, $data['vehicle_id'] ?? $data['vehicle_uuid'] ?? null);
        }

        if (array_key_exists('route_id', $data) || array_key_exists('route_uuid', $data)) {
            $run->route_id = $this->resolveRouteId($run->merchant, $data['route_id'] ?? $data['route_uuid'] ?? null);
        }

        if (array_key_exists('planned_start_at', $data)) {
            $run->planned_start_at = $data['planned_start_at'];
        }

        if (array_key_exists('service_area', $data)) {
            $run->service_area = $data['service_area'];
        }

        if (array_key_exists('notes', $data)) {
            $run->notes = $data['notes'];
        }

        $run->save();
        $this->syncDriverVehicleAssignment($run);
        $this->internalBookingLifecycleService->syncRunBookingDrivers($run->fresh());

        return $this->loadRun($run);
    }

    public function attachShipments(Run $run, array $shipmentUuids): Run
    {
        if (!$run->isMutable()) {
            throw new ConflictHttpException('Run shipments can only be modified while run is draft or dispatched.');
        }

        return DB::transaction(function () use ($run, $shipmentUuids) {
            $shipments = Shipment::query()
                ->whereIn('uuid', $shipmentUuids)
                ->get()
                ->keyBy('uuid');

            foreach ($shipmentUuids as $shipmentUuid) {
                $shipment = $shipments->get($shipmentUuid);
                if (!$shipment) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} was not found.");
                }

                if ($shipment->merchant_id !== $run->merchant_id) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} belongs to a different merchant.");
                }

                if ((int) $shipment->environment_id !== (int) $run->environment_id) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} belongs to a different environment.");
                }

                if (in_array($shipment->status, ['cancelled', 'delivered', 'failed'], true)) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} is already terminal and cannot be attached.");
                }

                $alreadyAssigned = RunShipment::query()
                    ->where('shipment_id', $shipment->id)
                    ->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('run', function (Builder $builder) use ($run) {
                        $builder->where('id', '!=', $run->id)
                            ->whereIn('status', [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS]);
                    })
                    ->exists();

                if ($alreadyAssigned) {
                    throw new ConflictHttpException("Shipment {$shipmentUuid} is already attached to another active run.");
                }

                $runShipment = RunShipment::query()
                    ->where('run_id', $run->id)
                    ->where('shipment_id', $shipment->id)
                    ->first();

                if ($runShipment) {
                    if ($runShipment->status === RunShipment::STATUS_REMOVED) {
                        $runShipment->status = RunShipment::STATUS_PLANNED;
                        $runShipment->save();
                    }

                    continue;
                }

                RunShipment::create([
                    'run_id' => $run->id,
                    'shipment_id' => $shipment->id,
                    'status' => RunShipment::STATUS_PLANNED,
                ]);
            }

            return $this->loadRun($run->fresh());
        });
    }

    public function detachShipment(Run $run, string $shipmentUuid): Run
    {
        if (!$run->isMutable()) {
            throw new ConflictHttpException('Run shipments can only be modified while run is draft or dispatched.');
        }

        $shipmentId = Shipment::where('uuid', $shipmentUuid)->value('id');
        if (!$shipmentId) {
            throw new UnprocessableEntityHttpException('Shipment was not found.');
        }

        $runShipment = RunShipment::query()
            ->where('run_id', $run->id)
            ->where('shipment_id', $shipmentId)
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->first();

        if (!$runShipment) {
            throw new UnprocessableEntityHttpException('Shipment is not attached to this run.');
        }

        $runShipment->status = RunShipment::STATUS_REMOVED;
        $runShipment->save();

        return $this->loadRun($run->fresh());
    }

    public function dispatchRun(Run $run): Run
    {
        if ($run->status !== Run::STATUS_DRAFT) {
            throw new ConflictHttpException('Only draft runs can be dispatched.');
        }

        $activeShipmentsCount = $run->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)->count();
        if ($activeShipmentsCount === 0) {
            throw new UnprocessableEntityHttpException('Run must have at least one shipment before dispatch.');
        }

        $run->status = Run::STATUS_DISPATCHED;
        $run->save();

        return $this->loadRun($run->fresh());
    }

    public function startRun(Run $run): Run
    {
        if (!in_array($run->status, [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED], true)) {
            throw new ConflictHttpException('Only draft or dispatched runs can be started.');
        }

        if (!$run->driver_id) {
            throw new UnprocessableEntityHttpException('Run must have a driver before it can be started.');
        }

        $activeShipmentsCount = $run->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)->count();
        if ($activeShipmentsCount === 0) {
            throw new UnprocessableEntityHttpException('Run must have at least one shipment before start.');
        }

        DB::transaction(function () use ($run) {
            $run->status = Run::STATUS_IN_PROGRESS;
            $run->started_at = now();
            $run->save();

            $run->runShipments()
                ->where('status', RunShipment::STATUS_PLANNED)
                ->update(['status' => RunShipment::STATUS_ACTIVE]);

            $this->internalBookingLifecycleService->markRunShipmentsInTransit($run->fresh(), $run->started_at);
        });

        return $this->loadRun($run->fresh());
    }

    public function completeRun(Run $run): Run
    {
        if ($run->status !== Run::STATUS_IN_PROGRESS) {
            throw new ConflictHttpException('Only in-progress runs can be completed.');
        }

        return DB::transaction(function () use ($run) {
            $runShipments = $run->runShipments()
                ->with('shipment')
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->get();

            if ($runShipments->isEmpty()) {
                throw new UnprocessableEntityHttpException('Run has no active shipments to complete.');
            }

            foreach ($runShipments as $runShipment) {
                $shipmentStatus = $runShipment->shipment?->status;
                if (!in_array($shipmentStatus, ['delivered', 'failed'], true)) {
                    throw new ConflictHttpException('All attached shipments must be delivered or failed before completing the run.');
                }

                $runShipment->status = $shipmentStatus === 'delivered'
                    ? RunShipment::STATUS_DONE
                    : RunShipment::STATUS_FAILED;
                $runShipment->save();
            }

            $run->status = Run::STATUS_COMPLETED;
            $run->completed_at = now();
            $run->save();

            return $this->loadRun($run->fresh());
        });
    }

    private function resolveMerchant(array $data, ?MerchantEnvironment $environment): Merchant
    {
        if ($environment) {
            return $environment->merchant;
        }

        $merchantUuid = $data['merchant_id'] ?? $data['merchant_uuid'] ?? null;
        if (!$merchantUuid) {
            throw new UnprocessableEntityHttpException('The merchant_id field is required.');
        }

        return Merchant::where('uuid', $merchantUuid)->firstOrFail();
    }

    private function resolveEnvironment(Merchant $merchant, array $data, ?MerchantEnvironment $environment): ?MerchantEnvironment
    {
        if ($environment) {
            return $environment;
        }

        $environmentUuid = $data['environment_id'] ?? $data['environment_uuid'] ?? null;
        if (!$environmentUuid) {
            return null;
        }

        return MerchantEnvironment::query()
            ->where('uuid', $environmentUuid)
            ->where('merchant_id', $merchant->id)
            ->firstOrFail();
    }

    private function resolveDriverId(Merchant $merchant, ?string $driverUuid): ?int
    {
        if (!$driverUuid) {
            return null;
        }

        $driver = Driver::query()
            ->where('uuid', $driverUuid)
            ->where(function (Builder $builder) use ($merchant) {
                $builder->where('merchant_id', $merchant->id)
                    ->orWhere(function (Builder $legacyBuilder) use ($merchant) {
                        $legacyBuilder->whereNull('merchant_id')
                            ->where('account_id', $merchant->account_id);
                    });
            })
            ->first();

        if (!$driver) {
            throw new UnprocessableEntityHttpException('Selected driver is invalid for this merchant account.');
        }

        return $driver->id;
    }

    private function resolveVehicleId(Merchant $merchant, ?string $vehicleUuid): ?int
    {
        if (!$vehicleUuid) {
            return null;
        }

        $vehicle = Vehicle::query()
            ->where('uuid', $vehicleUuid)
            ->where('account_id', $merchant->account_id)
            ->first();

        if (!$vehicle) {
            throw new UnprocessableEntityHttpException('Selected vehicle is invalid for this merchant account.');
        }

        return $vehicle->id;
    }

    private function resolveRouteId(Merchant $merchant, ?string $routeUuid): ?int
    {
        if (!$routeUuid) {
            return null;
        }

        $route = DeliveryRoute::query()
            ->where('uuid', $routeUuid)
            ->where('merchant_id', $merchant->id)
            ->first();

        if (!$route) {
            throw new UnprocessableEntityHttpException('Selected route is invalid for this merchant.');
        }

        return $route->id;
    }

    private function loadRun(Run $run): Run
    {
        return $run->load([
            'merchant',
            'environment',
            'driver.user',
            'vehicle',
            'latestLocationStop.location',
            'vehicleActivities.merchant',
            'vehicleActivities.vehicle.lastDriver.user',
            'vehicleActivities.location',
            'vehicleActivities.run.driver.user',
            'vehicleActivities.shipment',
            'route.routeStops.location',
            'originLocation',
            'destinationLocation',
            'runShipments.shipment',
        ]);
    }

    private function syncDriverVehicleAssignment(Run $run): void
    {
        if (!$run->driver_id || !$run->vehicle_id) {
            return;
        }

        $driver = Driver::query()->find($run->driver_id);
        $vehicle = Vehicle::query()->find($run->vehicle_id);

        if (!$driver || !$vehicle) {
            return;
        }

        $this->driverVehicleService->assignVehicle($driver, $vehicle);
    }
}
