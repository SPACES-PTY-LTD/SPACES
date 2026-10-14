<?php

namespace App\Services;

use App\Models\DeliveryRoute;
use App\Models\Driver;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Support\RunActivityQuery;
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
        private readonly VehicleOdometerService $vehicleOdometerService,
    ) {}

    public function listRuns(User $user, array $filters, ?MerchantEnvironment $environment = null): LengthAwarePaginator
    {
        $query = Run::query()
            ->with([
                'additionalCosts',
                'latestEndRequest.requester', 'latestEndRequest.reviewer',
                'merchant',
                'environment',
                'driver.user',
                'vehicle.vehicleType',
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
                'runShipments.shipment.booking',
                'runShipments.shipment.pickupLocation',
                'runShipments.shipment.dropoffLocation',
                'deliveryNoteImports.shipments',
            ]);

        if (filter_var($filters['summary'] ?? false, FILTER_VALIDATE_BOOL)) {
            $query->addSelect(['speeding_alert_count' => RunActivityQuery::forRunRow()
                ->selectRaw('COUNT(*)')->where('event_type', VehicleActivity::EVENT_SPEEDING)])->withoutEagerLoads()->with([
                'merchant',
                'driver.user',
                'vehicle',
                'additionalCosts:id,run_id,currency,amount',
                'deliveryNoteImports:id,run_id,uuid,original_name,mime_type',
                'latestEndRequest.requester', 'latestEndRequest.reviewer',
                'originLocation',
                'destinationLocation',
                'runShipments.shipment.pickupLocation',
                'runShipments.shipment.dropoffLocation',
                'vehicleActivities' => fn ($activities) => $activities
                    ->select('id', 'run_id', 'latitude', 'longitude', 'occurred_at')
                    ->whereNotNull('latitude')->whereNotNull('longitude')
                    ->whereHas('run', fn ($runs) => $runs->where(fn ($missing) => $missing
                        ->whereNull('odometer_start_km')->orWhereNull('odometer_end_km'))),
            ]);
        }

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

        if (! empty($filters['status'])) {
            $statuses = array_filter(
                is_array($filters['status']) ? $filters['status'] : explode(',', (string) $filters['status']),
                fn (string $status) => in_array($status, [
                    Run::STATUS_DRAFT,
                    Run::STATUS_DISPATCHED,
                    Run::STATUS_IN_PROGRESS,
                    Run::STATUS_COMPLETED,
                    Run::STATUS_CANCELLED,
                ], true)
            );

            if ($statuses !== []) {
                $query->whereIn('status', $statuses);
            }
        }

        if (! empty($filters['date'])) {
            $query->whereDate('planned_start_at', $filters['date']);
        }

        if (! empty($filters['from'])) {
            $query->whereRaw('DATE(COALESCE(started_at, planned_start_at, created_at)) >= ?', [$filters['from']]);
        }

        if (! empty($filters['to'])) {
            $query->whereRaw('DATE(COALESCE(started_at, planned_start_at, created_at)) <= ?', [$filters['to']]);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->where('uuid', 'like', '%'.$search.'%')
                    ->orWhere('status', 'like', '%'.$search.'%')
                    ->orWhere('service_area', 'like', '%'.$search.'%')
                    ->orWhere('notes', 'like', '%'.$search.'%')
                    ->orWhereHas('driver.user', function (Builder $driverBuilder) use ($search) {
                        $driverBuilder
                            ->where('name', 'like', '%'.$search.'%')
                            ->orWhere('email', 'like', '%'.$search.'%');
                    })
                    ->orWhereHas('vehicle', function (Builder $vehicleBuilder) use ($search) {
                        $vehicleBuilder
                            ->where('plate_number', 'like', '%'.$search.'%')
                            ->orWhere('ref_code', 'like', '%'.$search.'%');
                    });
            });
        }

        if (filter_var($filters['active_only'] ?? false, FILTER_VALIDATE_BOOL)) {
            $query->whereNull('completed_at');
        }

        if (filter_var($filters['with_shipments'] ?? false, FILTER_VALIDATE_BOOL)) {
            $query->whereHas('runShipments', function (Builder $builder) {
                $builder->where('status', '!=', RunShipment::STATUS_REMOVED);
            });
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return app(RunListSorter::class)->paginate($query, $filters, max(1, $perPage));
    }

    public function createRun(array $data, ?MerchantEnvironment $environment = null): Run
    {
        return DB::transaction(function () use ($data, $environment) {
            $merchant = $this->resolveMerchant($data, $environment);
            $environmentModel = $this->resolveEnvironment($merchant, $data, $environment);

            Merchant::whereKey($merchant->id)->lockForUpdate()->firstOrFail();
            $scheduled = (bool) ($data['schedule_managed'] ?? false);
            $requestData = $data;
            ksort($requestData);
            $requestHash = hash('sha256', json_encode($requestData));
            if ($scheduled && ! empty($data['schedule_request_id'])) {
                $existing = Run::where('schedule_request_id', $data['schedule_request_id'])->first();
                if ($existing) {
                    if ($existing->merchant_id !== $merchant->id || (int) $existing->environment_id !== (int) $environmentModel?->id || $existing->schedule_request_hash !== $requestHash) {
                        throw new ConflictHttpException('This creation request was already used for a different plan.');
                    }
                    return $this->loadRun($existing);
                }
            }
            if ($scheduled && (empty($data['planned_start_at']) || empty($data['origin_location_id']) || empty($data['destination_location_id']) || empty($data['vehicle_id']))) {
                throw new UnprocessableEntityHttpException('Scheduled runs require a truck, planned time, start and end locations.');
            }

            $run = Run::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $environmentModel?->id,
                'driver_id' => $this->resolveDriverId($merchant, $data['driver_id'] ?? $data['driver_uuid'] ?? null),
                'vehicle_id' => $this->resolveVehicleId($merchant, $data['vehicle_id'] ?? $data['vehicle_uuid'] ?? null),
                'route_id' => $this->resolveRouteId($merchant, $data['route_id'] ?? $data['route_uuid'] ?? null),
                'status' => Run::STATUS_DRAFT,
                'schedule_managed' => $scheduled,
                'schedule_request_id' => $scheduled ? ($data['schedule_request_id'] ?? null) : null,
                'schedule_request_hash' => $scheduled ? $requestHash : null,
                'driver_workflow' => $scheduled,
                'origin_location_id' => $this->resolveLocationId($merchant, $environmentModel?->id, $data['origin_location_id'] ?? null),
                'destination_location_id' => $this->resolveLocationId($merchant, $environmentModel?->id, $data['destination_location_id'] ?? null),
                'planned_start_at' => isset($data['planned_start_at']) ? \Illuminate\Support\Carbon::parse($data['planned_start_at'])->utc() : null,
                'service_area' => $data['service_area'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $this->validateScheduleResources($run);
            $this->syncDriverVehicleAssignment($run);
            if (! empty($data['shipment_ids'])) $run = $this->attachShipments($run, $data['shipment_ids']);

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
        return DB::transaction(function () use ($run, $data) {
            Merchant::whereKey($run->merchant_id)->lockForUpdate()->firstOrFail();
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            if (! $run->isMutable()) {
                throw new ConflictHttpException('Run can only be edited while in draft or dispatched status.');
            }

            if (array_key_exists('expected_driver_id', $data) && $run->driver?->uuid !== $data['expected_driver_id']) {
                throw new ConflictHttpException('The assigned driver changed. Refresh before assigning a driver.');
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
                $run->planned_start_at = $data['planned_start_at'] ? \Illuminate\Support\Carbon::parse($data['planned_start_at'])->utc() : null;
            }

            if (array_key_exists('service_area', $data)) {
                $run->service_area = $data['service_area'];
            }

            if (array_key_exists('notes', $data)) {
                $run->notes = $data['notes'];
            }

            foreach (['origin_location_id', 'destination_location_id'] as $field) {
                if (array_key_exists($field, $data)) $run->{$field} = $this->resolveLocationId($run->merchant, $run->environment_id, $data[$field]);
            }
            if ($run->schedule_managed && (! $run->planned_start_at || ! $run->origin_location_id || ! $run->destination_location_id || ! $run->vehicle_id)) {
                throw new UnprocessableEntityHttpException('Scheduled runs require a truck, planned time, start and end locations.');
            }
            $this->validateScheduleResources($run);
            if ($run->schedule_managed) $run->status = Run::STATUS_DRAFT;
            $run->save();
            $this->syncDriverVehicleAssignment($run);
            if (! $run->schedule_managed || $run->status !== Run::STATUS_DRAFT) $this->internalBookingLifecycleService->syncRunBookingDrivers($run->fresh());

            return $this->loadRun($run);
        }, 5);
    }

    public function attachShipments(Run $run, array $shipmentUuids, bool $allowInProgress = false): Run
    {
        return DB::transaction(function () use ($run, $shipmentUuids, $allowInProgress) {
            Merchant::whereKey($run->merchant_id)->lockForUpdate()->firstOrFail();
            $run = Run::query()->lockForUpdate()->findOrFail($run->id);
            $canAttach = $run->isMutable() || ($allowInProgress && $run->status === Run::STATUS_IN_PROGRESS);
            if (! $canAttach) {
                throw new ConflictHttpException('Shipments cannot be added to this run in its current status.');
            }
            $attachmentStatus = $run->status === Run::STATUS_IN_PROGRESS
                ? RunShipment::STATUS_ACTIVE
                : RunShipment::STATUS_PLANNED;
            $shipments = Shipment::query()
                ->whereIn('uuid', $shipmentUuids)
                ->orderBy('id')->lockForUpdate()->get()
                ->keyBy('uuid');

            foreach ($shipmentUuids as $shipmentUuid) {
                $shipment = $shipments->get($shipmentUuid);
                if (! $shipment) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} was not found.");
                }

                if ($shipment->merchant_id !== $run->merchant_id) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} belongs to a different merchant.");
                }

                if ((int) $shipment->environment_id !== (int) $run->environment_id) {
                    throw new UnprocessableEntityHttpException("Shipment {$shipmentUuid} belongs to a different environment.");
                }

                if (in_array($shipment->status, ['cancelled', 'delivered', 'failed', 'returned'], true)) {
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
                        $runShipment->status = $attachmentStatus;
                        $runShipment->save();
                    }

                    continue;
                }

                RunShipment::create([
                    'run_id' => $run->id,
                    'shipment_id' => $shipment->id,
                    'status' => $attachmentStatus,
                ]);
            }

            return $this->loadRun($run->fresh());
        });
    }

    public function detachShipment(Run $run, string $shipmentUuid): Run
    {
        return DB::transaction(function () use ($run, $shipmentUuid) {
            Merchant::whereKey($run->merchant_id)->lockForUpdate()->firstOrFail();
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            if (! $run->isMutable()) {
                throw new ConflictHttpException('Run shipments can only be modified while run is draft or dispatched.');
            }

            $shipmentId = Shipment::where('uuid', $shipmentUuid)->value('id');
            if (! $shipmentId) {
                throw new UnprocessableEntityHttpException('Shipment was not found.');
            }

            $runShipment = RunShipment::query()
                ->where('run_id', $run->id)
                ->where('shipment_id', $shipmentId)
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->first();

            if (! $runShipment) {
                throw new UnprocessableEntityHttpException('Shipment is not attached to this run.');
            }

            $runShipment->status = RunShipment::STATUS_REMOVED;
            $runShipment->save();

            return $this->loadRun($run->fresh());
        }, 5);
    }

    public function dispatchRun(Run $run): Run
    {
        if ($run->schedule_managed) {
            app(RunReadinessService::class)->assertReady($run);
            return $this->loadRun($run);
        }
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

    public function startRun(Run $run, ?int $odometerStartKm = null): Run
    {
        return DB::transaction(function () use ($run, $odometerStartKm) {
            Merchant::whereKey($run->merchant_id)->lockForUpdate()->firstOrFail();
            app(RunReadinessService::class)->assertReady($run);
            Driver::whereKey($run->driver_id)->lockForUpdate()->first();
            Vehicle::whereKey($run->vehicle_id)->lockForUpdate()->first();
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            if ($run->schedule_managed && $run->status !== Run::STATUS_DISPATCHED) throw new ConflictHttpException('This planned run is no longer ready.');
            if (! in_array($run->status, [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED], true)) {
                throw new ConflictHttpException('Only draft or dispatched runs can be started.');
            }

            if (! $run->driver_id) {
                throw new UnprocessableEntityHttpException('Run must have a driver before it can be started.');
            }

            $activeShipmentsCount = $run->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)->count();
            if ($activeShipmentsCount === 0) {
                throw new UnprocessableEntityHttpException('Run must have at least one shipment before start.');
            }

            $run->status = Run::STATUS_IN_PROGRESS;
            $run->started_at = now();
            if ($odometerStartKm !== null) {
                $run->odometer_start_km = $odometerStartKm;
            }
            $run->save();

            $this->vehicleOdometerService->syncHigherReading($run->vehicle, $odometerStartKm);

            $run->runShipments()
                ->where('status', RunShipment::STATUS_PLANNED)
                ->update(['status' => RunShipment::STATUS_ACTIVE]);

            $this->internalBookingLifecycleService->markRunShipmentsInTransit($run->fresh(), $run->started_at);
            return $this->loadRun($run->fresh());
        }, 5);
    }

    public function completeRun(Run $run, ?int $odometerEndKm = null): Run
    {
        if ($run->status !== Run::STATUS_IN_PROGRESS) {
            throw new ConflictHttpException('Only in-progress runs can be completed.');
        }

        if ($odometerEndKm !== null && $run->odometer_start_km !== null && $odometerEndKm < $run->odometer_start_km) {
            throw new UnprocessableEntityHttpException('Run end odometer cannot be lower than the start odometer.');
        }

        return DB::transaction(function () use ($run, $odometerEndKm) {
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            if ($run->status !== Run::STATUS_IN_PROGRESS) {
                throw new ConflictHttpException('Only in-progress runs can be completed.');
            }
            $runShipments = $run->runShipments()
                ->with('shipment')
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->get();

            if ($runShipments->isEmpty()) {
                throw new UnprocessableEntityHttpException('Run has no active shipments to complete.');
            }

            foreach ($runShipments as $runShipment) {
                $shipmentStatus = $runShipment->shipment?->status;
                if (! in_array($shipmentStatus, ['delivered', 'failed'], true)) {
                    throw new ConflictHttpException('All attached shipments must be delivered or failed before completing the run.');
                }

                $runShipment->status = $shipmentStatus === 'delivered'
                    ? RunShipment::STATUS_DONE
                    : RunShipment::STATUS_FAILED;
                $runShipment->save();
            }

            $run->status = Run::STATUS_COMPLETED;
            $run->completed_at = now();
            if ($odometerEndKm !== null) {
                $run->odometer_end_km = $odometerEndKm;
            }
            $run->save();

            $this->vehicleOdometerService->syncHigherReading($run->vehicle, $odometerEndKm);

            return $this->loadRun($run->fresh());
        });
    }

    private function resolveMerchant(array $data, ?MerchantEnvironment $environment): Merchant
    {
        if ($environment) {
            return $environment->merchant;
        }

        $merchantUuid = $data['merchant_id'] ?? $data['merchant_uuid'] ?? null;
        if (! $merchantUuid) {
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
        if (! $environmentUuid) {
            return null;
        }

        return MerchantEnvironment::query()
            ->where('uuid', $environmentUuid)
            ->where('merchant_id', $merchant->id)
            ->firstOrFail();
    }

    private function validateScheduleResources(Run $run): void
    {
        if (! $run->schedule_managed) return;
        $driver = $run->driver_id ? Driver::find($run->driver_id) : null;
        $vehicle = $run->vehicle_id ? Vehicle::find($run->vehicle_id) : null;
        if (($driver && (int) $driver->merchant_id !== (int) $run->merchant_id) || ($vehicle && (int) $vehicle->merchant_id !== (int) $run->merchant_id)) {
            throw new UnprocessableEntityHttpException('Choose a driver and truck belonging to this merchant.');
        }
    }

    private function resolveLocationId(Merchant $merchant, ?int $environmentId, ?string $uuid): ?int
    {
        if (! $uuid) return null;
        $location = Location::where('uuid', $uuid)->where('account_id', $merchant->account_id)
            ->where('merchant_id', $merchant->id)
            ->where(fn ($q) => $q->whereNull('environment_id')->orWhere('environment_id', $environmentId))->first();
        if (! $location) throw new UnprocessableEntityHttpException('Choose a location in this merchant and environment.');
        return $location->id;
    }

    private function resolveDriverId(Merchant $merchant, ?string $driverUuid): ?int
    {
        if (! $driverUuid) {
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

        if (! $driver) {
            throw new UnprocessableEntityHttpException('Selected driver is invalid for this merchant account.');
        }

        return $driver->id;
    }

    private function resolveVehicleId(Merchant $merchant, ?string $vehicleUuid): ?int
    {
        if (! $vehicleUuid) {
            return null;
        }

        $vehicle = Vehicle::query()
            ->where('uuid', $vehicleUuid)
            ->where('account_id', $merchant->account_id)
            ->first();

        if (! $vehicle) {
            throw new UnprocessableEntityHttpException('Selected vehicle is invalid for this merchant account.');
        }

        return $vehicle->id;
    }

    private function resolveRouteId(Merchant $merchant, ?string $routeUuid): ?int
    {
        if (! $routeUuid) {
            return null;
        }

        $route = DeliveryRoute::query()
            ->where('uuid', $routeUuid)
            ->where('merchant_id', $merchant->id)
            ->first();

        if (! $route) {
            throw new UnprocessableEntityHttpException('Selected route is invalid for this merchant.');
        }

        return $route->id;
    }

    private function loadRun(Run $run): Run
    {
        $run->load([
            'additionalCosts',
            'latestEndRequest.requester', 'latestEndRequest.reviewer',
            'merchant',
            'environment',
            'driver.user',
            'vehicle.vehicleType',
            'latestLocationStop.location.locationType',
            'route.routeStops.location.locationType',
            'originLocation.locationType',
            'destinationLocation.locationType',
            'runShipments.shipment.parcels',
            'runShipments.shipment.booking',
            'runShipments.shipment.pickupLocation.locationType',
            'runShipments.shipment.dropoffLocation.locationType',
            'deliveryNoteImports.shipments',
        ]);

        $activities = RunActivityQuery::forRuns([$run->id])->select('vehicle_activity.*')
            ->with([
                'merchant',
                'vehicle.lastDriver.user',
                'location.locationType',
                'run.driver.user',
                'shipment.booking',
                'shipment.pickupLocation',
                'shipment.dropoffLocation',
            ])
            ->orderBy('vehicle_activity.occurred_at')
            ->orderBy('vehicle_activity.id')
            ->get();

        $run->setRelation('vehicleActivities', $activities);

        return $run;
    }

    private function syncDriverVehicleAssignment(Run $run): void
    {
        if (($run->schedule_managed && $run->status === Run::STATUS_DRAFT) || ! $run->driver_id || ! $run->vehicle_id) {
            return;
        }

        $driver = Driver::query()->find($run->driver_id);
        $vehicle = Vehicle::query()->find($run->vehicle_id);

        if (! $driver || ! $vehicle) {
            return;
        }

        $this->driverVehicleService->assignVehicle($driver, $vehicle);
    }
}
