<?php

namespace App\Services;

use App\Events\VehicleActivityCreated;
use App\Models\Driver;
use App\Models\DriverVehicle;
use App\Models\Location;
use App\Models\LocationType;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Carbon\Carbon;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class AutoRunLifecycleService
{
    private const AUTOMATION_EVENT_ENTRY = 'entry';
    private const AUTOMATION_EVENT_EXIT = 'exit';
    private ?array $activeAutomationContext = null;

    public function __construct(
        private ActivityLogService $activityLogService,
        private RouteService $routeService,
        private InternalBookingLifecycleService $internalBookingLifecycleService,
        private ShipmentParcelService $shipmentParcelService,
    )
    {
    }

    public function processVehiclePosition(
        Vehicle $vehicle,
        Merchant $merchant,
        ?float $latitude,
        ?float $longitude,
        ?CarbonInterface $eventAt = null,
        ?float $speedKph = null,
        ?float $speedLimitKph = null,
        ?float $odometerKilometres = null,
        ?string $driverIntegrationId = null,
        array $providerPosition = []
    ): bool {
        if ($latitude === null || $longitude === null) {
            return false;
        }

        $occurredAt = Carbon::instance(($eventAt ?? now())->toDateTime());

        return DB::transaction(function () use (
            $vehicle,
            $merchant,
            $latitude,
            $longitude,
            $occurredAt,
            $speedKph,
            $speedLimitKph,
            $odometerKilometres,
            $driverIntegrationId,
            $providerPosition
        ) {
            $vehicle = Vehicle::query()->whereKey($vehicle->id)->lockForUpdate()->firstOrFail();

            $this->recordMotionAndSpeedingEvents(
                vehicle: $vehicle,
                merchant: $merchant,
                occurredAt: $occurredAt,
                latitude: $latitude,
                longitude: $longitude,
                speedKph: $speedKph,
                speedLimitKph: $speedLimitKph,
                odometerKilometres: $odometerKilometres,
                driverIntegrationId: $driverIntegrationId,
                providerPosition: $providerPosition,
            );

            $activeVisit = VehicleActivity::query()
                ->where('merchant_id', $merchant->id)
                ->where('vehicle_id', $vehicle->id)
                ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
                ->whereNull('exited_at')
                ->with('location')
                ->orderByDesc('entered_at')
                ->lockForUpdate()
                ->first();

            $location = $this->resolveGeofencedLocation($merchant, $latitude, $longitude);

            if ($activeVisit && $location && $activeVisit->location_id === $location->id) {
                $this->updateActivitySnapshot(
                    $activeVisit,
                    latitude: $latitude,
                    longitude: $longitude,
                    speedKph: $speedKph,
                    speedLimitKph: $speedLimitKph,
                    metadata: [
                        'driver_intergration_id' => $driverIntegrationId,
                        'odometer_kilometres' => $odometerKilometres,
                        'provider_position' => $providerPosition,
                    ],
                );

                return true;
            }

            if ($activeVisit && (!$location || $activeVisit->location_id !== $location->id)) {
                $activeVisit->fill([
                    'exited_at' => $occurredAt,
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'exit_reason' => VehicleActivity::EXIT_REASON_LEFT_GEOFENCE,
                ])->save();

                $this->closeShipmentStageAttempt($activeVisit, VehicleActivity::EVENT_SHIPMENT_DELIVERY, $occurredAt);
                $this->markAutoShipmentDeliveredOnLocationExit($activeVisit, $occurredAt);
                if ($activeVisit->location) {
                    $this->executeConfiguredLocationAutomation(
                        merchant: $merchant,
                        vehicle: $vehicle,
                        location: $activeVisit->location,
                        visit: $activeVisit,
                        occurredAt: $occurredAt,
                        event: self::AUTOMATION_EVENT_EXIT,
                        driverIntegrationId: $driverIntegrationId,
                    );
                }

                $this->recordVehicleActivity(
                    vehicle: $vehicle,
                    merchant: $merchant,
                    eventType: VehicleActivity::EVENT_EXITED_LOCATION,
                    occurredAt: $occurredAt,
                    latitude: $latitude,
                    longitude: $longitude,
                    location: $activeVisit->location,
                    runId: $activeVisit->run_id,
                    shipmentId: $activeVisit->shipment_id,
                    speedKph: $speedKph,
                    speedLimitKph: $speedLimitKph,
                    metadata: [
                        'driver_intergration_id' => $driverIntegrationId,
                        'odometer_kilometres' => $odometerKilometres,
                        'provider_position' => $providerPosition,
                        'visit_id' => $activeVisit->uuid,
                        'entered_at' => optional($activeVisit->entered_at)?->toIso8601String(),
                        'exited_at' => optional($activeVisit->exited_at)?->toIso8601String(),
                        'exit_reason' => $activeVisit->exit_reason,
                    ],
                );

                $this->activityLogService->log(
                    action: 'vehicle_exited',
                    entityType: 'vehicle_activity',
                    entity: $activeVisit,
                    accountId: $merchant->account_id,
                    merchantId: $merchant->id,
                    title: 'Vehicle exited location geofence',
                    metadata: [
                        'vehicle_id' => $vehicle->uuid,
                        'location_id' => $activeVisit->location?->uuid,
                        'visit_id' => $activeVisit->uuid,
                        'entered_at' => optional($activeVisit->entered_at)?->toIso8601String(),
                        'exited_at' => optional($activeVisit->exited_at)?->toIso8601String(),
                        'exit_reason' => $activeVisit->exit_reason,
                    ]
                );
            }

            if (!$location) {
                return false;
            }

            $visit = $this->recordVehicleActivity(
                vehicle: $vehicle,
                merchant: $merchant,
                eventType: VehicleActivity::EVENT_ENTERED_LOCATION,
                occurredAt: $occurredAt,
                latitude: $latitude,
                longitude: $longitude,
                location: $location,
                runId: null,
                speedKph: $speedKph,
                speedLimitKph: $speedLimitKph,
                metadata: [
                    'driver_intergration_id' => $driverIntegrationId,
                    'odometer_kilometres' => $odometerKilometres,
                    'provider_position' => $providerPosition,
                ],
                enteredAt: $occurredAt,
            );

            $this->activityLogService->log(
                action: 'vehicle_entered',
                entityType: 'vehicle_activity',
                entity: $visit,
                accountId: $merchant->account_id,
                merchantId: $merchant->id,
                title: 'Vehicle entered location geofence',
                metadata: [
                    'vehicle_id' => $vehicle->uuid,
                    'location_id' => $location->uuid,
                    'visit_id' => $visit->uuid,
                    'entered_at' => optional($visit->entered_at)?->toIso8601String(),
                ]
            );

            if (!$merchant->allow_auto_shipment_creations_at_locations) {
                return true;
            }

            if (!$location->locationType) {
                return true;
            }

            $this->executeConfiguredLocationAutomation(
                merchant: $merchant,
                vehicle: $vehicle,
                location: $location,
                visit: $visit,
                occurredAt: $occurredAt,
                event: self::AUTOMATION_EVENT_ENTRY,
                driverIntegrationId: $driverIntegrationId,
            );

            return true;
        });
    }

    private function handleCollectionPointEnter(
        Merchant $merchant,
        Vehicle $vehicle,
        Location $location,
        VehicleActivity $visit,
        CarbonInterface $occurredAt,
        ?string $driverIntegrationId = null
    ): void {
        $activeRun = $this->findActiveRun($merchant, $vehicle);
        $activeRunHasShipments = $activeRun ? $this->runHasShipments($activeRun) : false;
        $shouldCompleteExistingRun = $activeRunHasShipments && $this->shouldCompleteRunAtCollectionPoint($activeRun, $location);

        if ($activeRun && $shouldCompleteExistingRun) {
            $autoRoute = null;
            if ($activeRun->origin_location_id) {
                $originLocation = Location::query()->find($activeRun->origin_location_id);
                if ($originLocation) {
                    $autoRoute = $this->routeService->findOrCreateAutoRoute(
                        merchant: $merchant,
                        environment: $location->environment,
                        origin: $originLocation,
                        destination: $location
                    );
                }
            }

            $activeRun->fill([
                'status' => Run::STATUS_COMPLETED,
                'destination_location_id' => $location->id,
                'route_id' => $autoRoute?->id ?? $activeRun->route_id,
                'completed_at' => $occurredAt,
            ])->save();

            $this->recordVehicleActivity(
                vehicle: $vehicle,
                merchant: $merchant,
                eventType: VehicleActivity::EVENT_RUN_ENDED,
                occurredAt: $occurredAt,
                latitude: $visit->latitude !== null ? (float) $visit->latitude : null,
                longitude: $visit->longitude !== null ? (float) $visit->longitude : null,
                location: $location,
                runId: $activeRun->id,
                metadata: [
                    'reason' => 'collection_point_entry',
                    'ended_run_id' => $activeRun->uuid,
                    'location_id' => $location->uuid,
                ],
            );
        }

        if ($activeRun && !$shouldCompleteExistingRun) {
            $visit->run_id = $activeRun->id;
            $visit->save();
            $this->updateVehicleLastKnownDriver($visit);

            return;
        }

        $newRun = Run::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'environment_id' => $location->environment_id,
            'driver_id' => $this->resolveRunDriverId($merchant, $vehicle, $driverIntegrationId),
            'vehicle_id' => $vehicle->id,
            'status' => Run::STATUS_IN_PROGRESS,
            'auto_created' => true,
            'planned_start_at' => $occurredAt,
            'started_at' => $occurredAt,
            'origin_location_id' => $location->id,
            'notes' => 'Auto-created from geofence entry.',
        ]);

        $visit->run_id = $newRun->id;
        $visit->save();
        $this->updateVehicleLastKnownDriver($visit);

        $this->recordVehicleActivity(
            vehicle: $vehicle,
            merchant: $merchant,
            eventType: VehicleActivity::EVENT_RUN_STARTED,
            occurredAt: $occurredAt,
            latitude: $visit->latitude !== null ? (float) $visit->latitude : null,
            longitude: $visit->longitude !== null ? (float) $visit->longitude : null,
            location: $location,
            runId: $newRun->id,
            metadata: [
                'reason' => 'collection_point_entry',
                'run_id' => $newRun->uuid,
                'origin_location_id' => $location->uuid,
            ],
        );
    }

    private function resolveRunDriverId(
        Merchant $merchant,
        Vehicle $vehicle,
        ?string $driverIntegrationId
    ): ?int {
        if (!empty($driverIntegrationId)) {
            $driverId = Driver::query()
                ->where(function ($builder) use ($merchant) {
                    $builder->where('merchant_id', $merchant->id)
                        ->orWhere(function ($legacyBuilder) use ($merchant) {
                            $legacyBuilder->whereNull('merchant_id')
                                ->where('account_id', $merchant->account_id);
                        });
                })
                ->where('intergration_id', $driverIntegrationId)
                ->value('id');

            if ($driverId) {
                return (int) $driverId;
            }
        }

        $fallbackDriverId = DriverVehicle::query()
            ->where('vehicle_id', $vehicle->id)
            ->orderByDesc('id')
            ->value('driver_id');

        return $fallbackDriverId ? (int) $fallbackDriverId : null;
    }

    private function handleDeliveryPointEnter(
        Merchant $merchant,
        Vehicle $vehicle,
        Location $location,
        VehicleActivity $visit,
        CarbonInterface $occurredAt
    ): void {
        $run = $this->findActiveRun($merchant, $vehicle);
        if (!$run || !$run->origin_location_id) {
            return;
        }

        $visit->run_id = $run->id;
        $visit->save();
        $this->updateVehicleLastKnownDriver($visit);

        $existingRunShipment = RunShipment::query()
            ->where('run_id', $run->id)
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', function (Builder $builder) use ($location) {
                $builder->where('dropoff_location_id', $location->id);
            })
            ->with('shipment')
            ->first();

        if ($existingRunShipment?->shipment) {
            $visit->shipment_id = $existingRunShipment->shipment->id;
            $visit->save();
            if ((bool) $existingRunShipment->shipment->auto_created) {
                $this->internalBookingLifecycleService->ensureBookingForShipment($existingRunShipment->shipment, $run, $existingRunShipment->shipment->created_at ?? $occurredAt);
            }

            return;
        }

        $runStartedAt = Carbon::instance(($run->started_at ?? $occurredAt)->toDateTime());
        $collectionAt = Carbon::instance($runStartedAt->copy()->addSecond()->toDateTime());

        $shipment = Shipment::withTrashed()
            ->where('merchant_id', $merchant->id)
            ->where('merchant_order_ref', $this->autoOrderReference($run, $location))
            ->first();

        $createdShipment = false;
        if (!$shipment) {
            $shipment = Shipment::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $run->environment_id,
                'merchant_order_ref' => $this->autoOrderReference($run, $location),
                'status' => 'in_transit',
                'pickup_location_id' => $run->origin_location_id,
                'dropoff_location_id' => $location->id,
                'collection_date' => $collectionAt,
                'created_at' => $runStartedAt,
                'auto_assign' => true,
                'auto_created' => true,
                'notes' => 'Auto-created from geofence entry.',
                'metadata' => [
                    'auto_created' => true,
                    'auto_created_from' => 'vehicle_location_geofence',
                ],
            ]);

            $this->shipmentParcelService->createDefaultAutoCreatedParcel($shipment);
            $createdShipment = true;

            $this->recordVehicleActivity(
                vehicle: $vehicle,
                merchant: $merchant,
                eventType: VehicleActivity::EVENT_SHIPMENT_CREATED,
                occurredAt: $occurredAt,
                latitude: $visit->latitude !== null ? (float) $visit->latitude : null,
                longitude: $visit->longitude !== null ? (float) $visit->longitude : null,
                location: $location,
                runId: $run->id,
                shipmentId: $shipment->id,
                metadata: [
                    'reason' => 'delivery_point_entry',
                    'shipment_id' => $shipment->uuid,
                    'pickup_location_id' => optional($run->originLocation)->uuid,
                    'dropoff_location_id' => $location->uuid,
                ],
            );
        } elseif ($shipment->trashed()) {
            $shipment->restore();
        }

        if (!in_array($shipment->status, ['cancelled', 'delivered', 'failed'], true)) {
            $shipment->status = 'in_transit';
            $shipment->save();
        }

        $visit->shipment_id = $shipment->id;
        $visit->save();

        RunShipment::query()->updateOrCreate(
            [
                'run_id' => $run->id,
                'shipment_id' => $shipment->id,
            ],
            [
                'status' => $run->status === Run::STATUS_IN_PROGRESS
                    ? RunShipment::STATUS_ACTIVE
                    : RunShipment::STATUS_PLANNED,
            ]
        );

        $this->internalBookingLifecycleService->ensureBookingForShipment($shipment, $run, $shipment->created_at ?? $occurredAt);

        if ($createdShipment) {
            $this->recordShipmentStageActivities($vehicle, $merchant, $run, $location, $visit, $shipment, $occurredAt, $collectionAt);
        }
    }

    private function executeConfiguredLocationAutomation(
        Merchant $merchant,
        Vehicle $vehicle,
        Location $location,
        VehicleActivity $visit,
        CarbonInterface $occurredAt,
        string $event,
        ?string $driverIntegrationId = null
    ): void {
        foreach ($this->resolveLocationAutomationActions($merchant, $location, $event) as $index => $action) {
            if (!$this->automationConditionsMatch($merchant, $vehicle, $location, $visit, $action['conditions'] ?? [])) {
                continue;
            }

            $this->recordAutomationExecution($visit, $event, $action, $index, $location);
            $this->runWithAutomationContext($event, $action, $index, $location, function () use (
                $action,
                $merchant,
                $vehicle,
                $location,
                $visit,
                $occurredAt,
                $driverIntegrationId
            ) {
                match ($action['action'] ?? null) {
                    'record_vehicle_entry', 'record_vehicle_exit' => null,
                    'start_run' => $this->handleCollectionPointEnter($merchant, $vehicle, $location, $visit, $occurredAt, $driverIntegrationId),
                    'create_shipment' => $this->handleDeliveryPointEnter($merchant, $vehicle, $location, $visit, $occurredAt),
                    default => null,
                };
            });
        }
    }

    private function runWithAutomationContext(
        string $event,
        array $action,
        int $index,
        Location $location,
        callable $callback
    ): void {
        $previousContext = $this->activeAutomationContext;
        $conditions = array_values(array_filter($action['conditions'] ?? [], 'is_array'));

        $this->activeAutomationContext = [
            'event' => $event,
            'index' => $index,
            'action_id' => $action['id'] ?? null,
            'action' => $action['action'] ?? null,
            'location_id' => $location->uuid,
            'location_type_id' => $location->locationType?->uuid,
            'has_conditions' => $conditions !== [],
            'condition_count' => count($conditions),
            'conditions' => $conditions,
            'executed_at' => now()->toIso8601String(),
        ];

        try {
            $callback();
        } finally {
            $this->activeAutomationContext = $previousContext;
        }
    }

    private function resolveLocationAutomationActions(Merchant $merchant, Location $location, string $event): array
    {
        $location->loadMissing('locationType');

        $locationTypeUuid = $location->locationType?->uuid;
        $configuredRules = collect($merchant->location_automation_settings['location_types'] ?? []);

        if ($locationTypeUuid) {
            $configured = $configuredRules->firstWhere('location_type_id', $locationTypeUuid);
            if (is_array($configured) && isset($configured[$event]) && is_array($configured[$event])) {
                return $configured[$event];
            }
        }

        $fallbackRule = $location->locationType ? $this->buildFallbackAutomationRule($location->locationType) : null;

        return is_array($fallbackRule[$event] ?? null) ? $fallbackRule[$event] : [];
    }

    private function buildFallbackAutomationRule(LocationType $locationType): array
    {
        $entry = [
            ['id' => 'fallback-entry-record', 'action' => 'record_vehicle_entry', 'conditions' => []],
        ];
        $exit = [
            ['id' => 'fallback-exit-record', 'action' => 'record_vehicle_exit', 'conditions' => []],
        ];

        if ((bool) $locationType->collection_point) {
            $entry[] = ['id' => 'fallback-entry-start-run', 'action' => 'start_run', 'conditions' => []];
        }

        if ((bool) $locationType->delivery_point) {
            $entry[] = ['id' => 'fallback-entry-create-shipment', 'action' => 'create_shipment', 'conditions' => []];
        }

        return [
            self::AUTOMATION_EVENT_ENTRY => $entry,
            self::AUTOMATION_EVENT_EXIT => $exit,
        ];
    }

    private function automationConditionsMatch(
        Merchant $merchant,
        Vehicle $vehicle,
        Location $location,
        VehicleActivity $visit,
        array $conditions
    ): bool {
        if ($conditions === []) {
            return true;
        }

        $context = $this->buildAutomationContext($merchant, $vehicle, $location, $visit);

        foreach ($conditions as $condition) {
            $field = $condition['field'] ?? null;
            $operator = $condition['operator'] ?? 'equals';
            $expected = (string) ($condition['value'] ?? '');
            $actual = match ($field) {
                'has_active_run' => $context['has_active_run'] ? 'true' : 'false',
                'run_status' => (string) ($context['run_status'] ?? ''),
                'shipment_exists_for_location' => $context['shipment_exists_for_location'] ? 'true' : 'false',
                'shipment_status' => (string) ($context['shipment_status'] ?? ''),
                'location_matches_run_origin' => $context['location_matches_run_origin'] ? 'true' : 'false',
                'location_matches_run_destination' => $context['location_matches_run_destination'] ? 'true' : 'false',
                default => null,
            };

            if ($actual === null) {
                return false;
            }

            $matches = match ($operator) {
                'not_equals' => $actual !== $expected,
                default => $actual === $expected,
            };

            if (!$matches) {
                return false;
            }
        }

        return true;
    }

    private function buildAutomationContext(
        Merchant $merchant,
        Vehicle $vehicle,
        Location $location,
        VehicleActivity $visit
    ): array {
        $run = $visit->run_id
            ? Run::query()->find($visit->run_id)
            : $this->findActiveRun($merchant, $vehicle);

        $shipment = $this->resolveShipmentForAutomation($merchant, $location, $visit, $run);

        return [
            'has_active_run' => (bool) $run,
            'run_status' => $run?->status,
            'shipment_exists_for_location' => (bool) $shipment,
            'shipment_status' => $shipment?->status,
            'location_matches_run_origin' => $run ? (int) $run->origin_location_id === (int) $location->id : false,
            'location_matches_run_destination' => $run ? (int) $run->destination_location_id === (int) $location->id : false,
        ];
    }

    private function resolveShipmentForAutomation(
        Merchant $merchant,
        Location $location,
        VehicleActivity $visit,
        ?Run $run
    ): ?Shipment {
        if ($visit->shipment_id) {
            return Shipment::query()->find($visit->shipment_id);
        }

        if (!$run) {
            return null;
        }

        return Shipment::query()
            ->where('merchant_id', $merchant->id)
            ->where(function (Builder $builder) use ($location, $run) {
                $builder->where('dropoff_location_id', $location->id)
                    ->orWhere(function (Builder $nested) use ($run) {
                        $nested->where('id', function ($shipmentBuilder) use ($run) {
                            $shipmentBuilder->select('shipment_id')
                                ->from('run_shipments')
                                ->whereColumn('run_shipments.shipment_id', 'shipments.id')
                                ->where('run_id', $run->id)
                                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                                ->limit(1);
                        });
                    });
            })
            ->orderByDesc('id')
            ->first();
    }

    private function recordAutomationExecution(
        VehicleActivity $visit,
        string $event,
        array $action,
        int $index,
        Location $location
    ): void {
        $metadata = $visit->metadata ?? [];
        $metadata['automation'] = $metadata['automation'] ?? [];
        $metadata['automation'][] = [
            'event' => $event,
            'index' => $index,
            'action_id' => $action['id'] ?? null,
            'action' => $action['action'] ?? null,
            'location_id' => $location->uuid,
            'location_type_id' => $location->locationType?->uuid,
            'executed_at' => now()->toIso8601String(),
            'has_conditions' => !empty($action['conditions']),
            'condition_count' => count($action['conditions'] ?? []),
            'conditions' => $action['conditions'] ?? [],
        ];
        $visit->metadata = $metadata;
        $visit->save();
    }

    private function recordShipmentStageActivities(
        Vehicle $vehicle,
        Merchant $merchant,
        Run $run,
        Location $location,
        VehicleActivity $visit,
        Shipment $shipment,
        CarbonInterface $occurredAt,
        CarbonInterface $collectionAt
    ): void {
        $originLocation = $run->originLocation;
        $collectionEnteredAt = Carbon::instance((($run->started_at ?? $collectionAt)->toDateTime()));

        $this->recordVehicleActivity(
            vehicle: $vehicle,
            merchant: $merchant,
            eventType: VehicleActivity::EVENT_SHIPMENT_COLLECTION,
            occurredAt: $collectionAt,
            latitude: $originLocation?->latitude !== null ? (float) $originLocation->latitude : null,
            longitude: $originLocation?->longitude !== null ? (float) $originLocation->longitude : null,
            location: $originLocation,
            runId: $run->id,
            shipmentId: $shipment->id,
            metadata: [
                'reason' => 'shipment_created',
                'shipment_id' => $shipment->uuid,
                'origin_location_id' => optional($originLocation)->uuid,
            ],
            enteredAt: $collectionEnteredAt,
            exitedAt: $collectionAt,
        );

        $this->recordVehicleActivity(
            vehicle: $vehicle,
            merchant: $merchant,
            eventType: VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            occurredAt: $occurredAt,
            latitude: $visit->latitude !== null ? (float) $visit->latitude : null,
            longitude: $visit->longitude !== null ? (float) $visit->longitude : null,
            location: $location,
            runId: $run->id,
            shipmentId: $shipment->id,
            metadata: [
                'reason' => 'shipment_created',
                'shipment_id' => $shipment->uuid,
                'dropoff_location_id' => $location->uuid,
            ],
            enteredAt: $occurredAt,
        );
    }

    private function closeShipmentStageAttempt(
        VehicleActivity $visit,
        string $eventType,
        CarbonInterface $occurredAt
    ): void {
        if (!$visit->run_id || !$visit->shipment_id || !$visit->location_id) {
            return;
        }

        $activity = VehicleActivity::query()
            ->where('run_id', $visit->run_id)
            ->where('shipment_id', $visit->shipment_id)
            ->where('location_id', $visit->location_id)
            ->where('event_type', $eventType)
            ->whereNull('exited_at')
            ->orderByDesc('entered_at')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();

        if (!$activity) {
            return;
        }

        $activity->fill([
            'exited_at' => $occurredAt,
            'latitude' => $visit->latitude,
            'longitude' => $visit->longitude,
        ])->save();
    }

    private function markAutoShipmentDeliveredOnLocationExit(VehicleActivity $visit, CarbonInterface $occurredAt): void
    {
        if (!$visit->run_id || !$visit->location_id) {
            return;
        }

        $shipmentQuery = Shipment::query()
            ->where('merchant_id', $visit->merchant_id)
            ->where('auto_created', true)
            ->where('dropoff_location_id', $visit->location_id)
            ->whereNotIn('status', ['cancelled', 'delivered', 'failed'])
            ->whereHas('runShipments', function (Builder $builder) use ($visit) {
                $builder->where('run_id', $visit->run_id)
                    ->where('status', '!=', RunShipment::STATUS_REMOVED);
            });

        if ($visit->shipment_id) {
            $shipmentQuery->where('id', $visit->shipment_id);
        }

        $shipment = $shipmentQuery->orderByDesc('id')->first();

        if (!$shipment) {
            return;
        }

        $shipmentMetadata = $shipment->metadata ?? [];
        $shipmentMetadata['auto_delivered_at'] = $occurredAt->toIso8601String();
        $shipmentMetadata['auto_delivered_from'] = 'location_exit';
        $shipment->metadata = $shipmentMetadata;
        $shipment->status = 'delivered';
        $shipment->save();
        $this->internalBookingLifecycleService->markShipmentDelivered($shipment, $occurredAt);

        $vehicle = Vehicle::query()->find($visit->vehicle_id);
        if ($vehicle) {
            $this->recordVehicleActivity(
                vehicle: $vehicle,
                merchant: Merchant::query()->findOrFail($visit->merchant_id),
                eventType: VehicleActivity::EVENT_SHIPMENT_ENDED,
                occurredAt: $occurredAt,
                latitude: $visit->latitude !== null ? (float) $visit->latitude : null,
                longitude: $visit->longitude !== null ? (float) $visit->longitude : null,
                location: $visit->location,
                runId: $visit->run_id,
                shipmentId: $shipment->id,
                metadata: [
                    'reason' => 'location_exit',
                    'shipment_id' => $shipment->uuid,
                    'status' => $shipment->status,
                ],
            );
        }

        if ((int) $visit->shipment_id !== (int) $shipment->id) {
            $visit->shipment_id = $shipment->id;
            $visit->save();
        }

        RunShipment::query()
            ->where('run_id', $visit->run_id)
            ->where('shipment_id', $shipment->id)
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->update(['status' => RunShipment::STATUS_DONE]);
    }

    private function autoOrderReference(Run $run, Location $location): string
    {
        return sprintf('AUTO-SHIP-%s-%s', $run->id, $location->id);
    }

    private function findActiveRun(Merchant $merchant, Vehicle $vehicle): ?Run
    {
        return Run::query()
            ->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)
            ->whereIn('status', [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS])
            ->orderByDesc('started_at')
            ->orderByDesc('id')
            ->lockForUpdate()
            ->first();
    }

    private function runHasShipments(Run $run): bool
    {
        return RunShipment::query()
            ->where('run_id', $run->id)
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->exists();
    }

    private function shouldCompleteRunAtCollectionPoint(Run $run, Location $location): bool
    {
        if (!$run->origin_location_id || (int) $run->origin_location_id !== (int) $location->id) {
            return true;
        }

        return $this->runHasShipments($run);
    }

    private function isCollectionPoint(Location $location): bool
    {
        return (bool) ($location->locationType?->collection_point ?? false);
    }

    private function isDeliveryPoint(Location $location): bool
    {
        return (bool) ($location->locationType?->delivery_point ?? false);
    }

    private function locationPointPriority(Location $location): int
    {
        $collection = $this->isCollectionPoint($location);
        $delivery = $this->isDeliveryPoint($location);

        return match (true) {
            $collection && $delivery => 3,
            $collection => 2,
            $delivery => 1,
            default => 0,
        };
    }

    private function resolveGeofencedLocation(Merchant $merchant, float $latitude, float $longitude): ?Location
    {
        $driver = DB::connection()->getDriverName();

        $query = Location::query()
            ->with('locationType')
            ->where('merchant_id', $merchant->id)
            ->where(function (Builder $builder) {
                $builder->whereNotNull('polygon_bounds')
                    ->orWhere(function (Builder $locationBuilder) {
                        $locationBuilder->whereNotNull('latitude')
                            ->whereNotNull('longitude');
                    });
            })
            ->orderBy('id');

        if (in_array($driver, ['mysql', 'pgsql'], true)) {
            $query->select('locations.*')->selectRaw('ST_AsText(polygon_bounds) as polygon_wkt');
        }

        $locations = $query->get();

        $winner = null;
        $winnerDistance = null;

        foreach ($locations as $location) {
            $matches = false;
            if (!empty($location->polygon_wkt ?? null)) {
                $polygon = $this->parseWktPolygon($location->polygon_wkt);
                $matches = $polygon !== [] && $this->pointInPolygon($latitude, $longitude, $polygon);
            }

            if (!$matches && $location->latitude !== null && $location->longitude !== null) {
                $distance = $this->distanceMeters($latitude, $longitude, (float) $location->latitude, (float) $location->longitude);
                $radius = (float) (($location->metadata['geofence_radius_meters'] ?? 150));
                $matches = $distance <= $radius;
            }

            if (!$matches) {
                continue;
            }

            $distance = $this->distanceMeters($latitude, $longitude, (float) ($location->latitude ?? $latitude), (float) ($location->longitude ?? $longitude));

            $winnerPriority = $winner ? $this->locationPointPriority($winner) : -1;
            $locationPriority = $this->locationPointPriority($location);

            if ($winner === null || $locationPriority > $winnerPriority || ($locationPriority === $winnerPriority && $distance < $winnerDistance)) {
                $winner = $location;
                $winnerDistance = $distance;
            }
        }

        return $winner;
    }

    private function parseWktPolygon(string $wkt): array
    {
        $start = strpos($wkt, '((');
        $end = strrpos($wkt, '))');

        if ($start === false || $end === false || $end <= $start) {
            return [];
        }

        $pairs = explode(',', substr($wkt, $start + 2, $end - $start - 2));

        $points = [];
        foreach ($pairs as $pair) {
            $parts = preg_split('/\s+/', trim($pair));
            if (count($parts) !== 2 || !is_numeric($parts[0]) || !is_numeric($parts[1])) {
                continue;
            }

            $points[] = [(float) $parts[0], (float) $parts[1]];
        }

        return $points;
    }

    private function pointInPolygon(float $latitude, float $longitude, array $polygon): bool
    {
        $inside = false;
        $count = count($polygon);
        if ($count < 3) {
            return false;
        }

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            [$latI, $lngI] = $polygon[$i];
            [$latJ, $lngJ] = $polygon[$j];

            $intersects = (($lngI > $longitude) !== ($lngJ > $longitude))
                && ($latitude < ($latJ - $latI) * ($longitude - $lngI) / (($lngJ - $lngI) ?: 0.0000001) + $latI);

            if ($intersects) {
                $inside = !$inside;
            }
        }

        return $inside;
    }

    private function distanceMeters(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371000;
        $latFrom = deg2rad($lat1);
        $latTo = deg2rad($lat2);
        $latDelta = deg2rad($lat2 - $lat1);
        $lngDelta = deg2rad($lng2 - $lng1);

        $angle = 2 * asin(sqrt(
            sin($latDelta / 2) ** 2
            + cos($latFrom) * cos($latTo) * sin($lngDelta / 2) ** 2
        ));

        return $earthRadius * $angle;
    }

    private function recordMotionAndSpeedingEvents(
        Vehicle $vehicle,
        Merchant $merchant,
        CarbonInterface $occurredAt,
        float $latitude,
        float $longitude,
        ?float $speedKph,
        ?float $speedLimitKph,
        ?float $odometerKilometres,
        ?string $driverIntegrationId,
        array $providerPosition
    ): void {
        $state = $vehicle->metadata['vehicle_activity_state'] ?? [];
        $stateChanged = false;

            if ($speedKph !== null) {
                $motionState = $speedKph > 0
                    ? VehicleActivity::EVENT_MOVING
                    : VehicleActivity::EVENT_STOPPED;

            if (($state['motion'] ?? null) !== $motionState) {
                $this->recordVehicleActivity(
                    vehicle: $vehicle,
                    merchant: $merchant,
                    eventType: $motionState,
                    occurredAt: $occurredAt,
                    latitude: $latitude,
                    longitude: $longitude,
                    speedKph: $speedKph,
                    speedLimitKph: $speedLimitKph,
                    metadata: [
                        'driver_intergration_id' => $driverIntegrationId,
                        'odometer_kilometres' => $odometerKilometres,
                        'provider_position' => $providerPosition,
                    ],
                );
                $state['motion'] = $motionState;
                $stateChanged = true;
            } else {
                $this->updateLatestActivitySnapshot(
                    vehicle: $vehicle,
                    merchant: $merchant,
                    eventType: $motionState,
                    latitude: $latitude,
                    longitude: $longitude,
                    speedKph: $speedKph,
                    speedLimitKph: $speedLimitKph,
                    metadata: [
                        'driver_intergration_id' => $driverIntegrationId,
                        'odometer_kilometres' => $odometerKilometres,
                        'provider_position' => $providerPosition,
                    ],
                );
            }
        }

        $isSpeeding = $speedKph !== null && $speedLimitKph !== null && $speedKph > $speedLimitKph;
        if ($isSpeeding && !($state['is_speeding'] ?? false)) {
            $this->recordVehicleActivity(
                vehicle: $vehicle,
                merchant: $merchant,
                eventType: VehicleActivity::EVENT_SPEEDING,
                occurredAt: $occurredAt,
                latitude: $latitude,
                longitude: $longitude,
                speedKph: $speedKph,
                speedLimitKph: $speedLimitKph,
                metadata: [
                    'driver_intergration_id' => $driverIntegrationId,
                    'odometer_kilometres' => $odometerKilometres,
                    'provider_position' => $providerPosition,
                ],
            );
            $state['is_speeding'] = true;
            $stateChanged = true;
        } elseif ($isSpeeding && ($state['is_speeding'] ?? false)) {
            $this->updateLatestActivitySnapshot(
                vehicle: $vehicle,
                merchant: $merchant,
                eventType: VehicleActivity::EVENT_SPEEDING,
                latitude: $latitude,
                longitude: $longitude,
                speedKph: $speedKph,
                speedLimitKph: $speedLimitKph,
                metadata: [
                    'driver_intergration_id' => $driverIntegrationId,
                    'odometer_kilometres' => $odometerKilometres,
                    'provider_position' => $providerPosition,
                ],
            );
        } elseif (!$isSpeeding && ($state['is_speeding'] ?? false)) {
            $state['is_speeding'] = false;
            $stateChanged = true;
        }

        if ($stateChanged) {
            $metadata = $vehicle->metadata ?? [];
            $metadata['vehicle_activity_state'] = $state;
            $vehicle->metadata = $metadata;
            $vehicle->save();
        }
    }

    private function recordVehicleActivity(
        Vehicle $vehicle,
        Merchant $merchant,
        string $eventType,
        CarbonInterface $occurredAt,
        ?float $latitude = null,
        ?float $longitude = null,
        ?Location $location = null,
        ?int $runId = null,
        ?int $shipmentId = null,
        ?float $speedKph = null,
        ?float $speedLimitKph = null,
        array $metadata = [],
        ?CarbonInterface $enteredAt = null,
        ?CarbonInterface $exitedAt = null,
        ?string $exitReason = null
    ): VehicleActivity {
        if ($this->activeAutomationContext !== null) {
            $metadata['automation_action'] = $this->activeAutomationContext;
        }

        $activity = VehicleActivity::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'location_id' => $location?->id,
            'run_id' => $runId,
            'shipment_id' => $shipmentId,
            'event_type' => $eventType,
            'occurred_at' => $occurredAt,
            'entered_at' => $enteredAt,
            'exited_at' => $exitedAt,
            'latitude' => $latitude,
            'longitude' => $longitude,
            'speed_kph' => $speedKph,
            'speed_limit_kph' => $speedLimitKph,
            'exit_reason' => $exitReason,
            'metadata' => $metadata !== [] ? $metadata : null,
        ]);

        $activity->loadMissing(['merchant', 'vehicle', 'location', 'run.driver.user', 'shipment']);
        $this->updateVehicleLastKnownDriver($activity);
        $activity->load('vehicle.lastDriver.user');
        event(new VehicleActivityCreated($activity));

        return $activity;
    }

    private function updateVehicleLastKnownDriver(VehicleActivity $activity): void
    {
        if (!in_array($activity->event_type, VehicleActivity::DRIVER_SNAPSHOT_EVENT_TYPES, true)) {
            return;
        }

        $driverId = $this->resolveLastKnownDriverId($activity);
        if (!$driverId || !$activity->created_at) {
            return;
        }

        $vehicle = Vehicle::query()->whereKey($activity->vehicle_id)->lockForUpdate()->first();
        if (!$vehicle) {
            return;
        }

        if ($vehicle->driver_logged_at && $vehicle->driver_logged_at->gt($activity->created_at)) {
            return;
        }

        $vehicle->last_driver_id = $driverId;
        $vehicle->driver_logged_at = $activity->created_at;
        $vehicle->save();
    }

    private function resolveLastKnownDriverId(VehicleActivity $activity): ?int
    {
        $driverIntegrationId = $activity->metadata['driver_intergration_id'] ?? null;
        if (!empty($driverIntegrationId)) {
            $driverId = Driver::query()
                ->where('account_id', $activity->account_id)
                ->where('intergration_id', $driverIntegrationId)
                ->value('id');

            if ($driverId) {
                return (int) $driverId;
            }
        }

        if ($activity->run_id) {
            $driverId = Run::query()->whereKey($activity->run_id)->value('driver_id');

            return $driverId ? (int) $driverId : null;
        }

        return null;
    }

    private function updateLatestActivitySnapshot(
        Vehicle $vehicle,
        Merchant $merchant,
        string $eventType,
        ?float $latitude,
        ?float $longitude,
        ?float $speedKph,
        ?float $speedLimitKph,
        array $metadata = []
    ): void {
        $activity = VehicleActivity::query()
            ->where('merchant_id', $merchant->id)
            ->where('vehicle_id', $vehicle->id)
            ->where('event_type', $eventType)
            ->orderByDesc('occurred_at')
            ->orderByDesc('id')
            ->first();

        if (!$activity) {
            return;
        }

        $this->updateActivitySnapshot($activity, $latitude, $longitude, $speedKph, $speedLimitKph, $metadata);
    }

    private function updateActivitySnapshot(
        VehicleActivity $activity,
        ?float $latitude,
        ?float $longitude,
        ?float $speedKph,
        ?float $speedLimitKph,
        array $metadata = []
    ): void {
        $activity->latitude = $latitude;
        $activity->longitude = $longitude;
        $activity->speed_kph = $speedKph;
        $activity->speed_limit_kph = $speedLimitKph;
        $activity->metadata = array_merge($activity->metadata ?? [], $metadata);
        $activity->save();
    }
}
