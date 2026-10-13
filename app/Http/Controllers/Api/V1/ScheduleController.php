<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRunRequest;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\Vehicle;
use App\Services\ActivityLogService;
use App\Services\RunReadinessService;
use App\Services\RunService;
use App\Support\ApiResponse;
use App\Support\ProfilePhotoUrl;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Throwable;

class ScheduleController extends Controller
{
    private function context(Request $request): array
    {
        $data = $request->validate(['merchant_id' => ['required', 'uuid'], 'environment_id' => ['nullable', 'uuid']]);
        $merchant = Merchant::where('uuid', $data['merchant_id'])->firstOrFail();
        $this->authorize('view', new Run(['merchant_id' => $merchant->id]));
        $context = $request->attributes->get('merchant_environment');
        abort_if($context && $context->merchant_id !== $merchant->id, 403);
        $environment = $context ?? (! empty($data['environment_id'])
            ? MerchantEnvironment::where('merchant_id', $merchant->id)->where('uuid', $data['environment_id'])->firstOrFail() : null);
        abort_if($context && ! empty($data['environment_id']) && $context->uuid !== $data['environment_id'], 403);

        return [$merchant, $environment];
    }

    private function page($paginator): array
    {
        return ['current_page' => $paginator->currentPage(), 'last_page' => $paginator->lastPage(), 'total' => $paginator->total()];
    }

    public function index(Request $request, RunReadinessService $readiness)
    {
        [$merchant, $environment] = $this->context($request);
        $filters = $request->validate([
            'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:from'],
            'truck_search' => ['nullable', 'string', 'max:255'], 'driver_search' => ['nullable', 'string', 'max:255'],
            'shipment_search' => ['nullable', 'string', 'max:255'], 'availability' => ['nullable', 'in:all,available,busy'],
            'fleet_status' => ['nullable', 'in:all,active,inactive'], 'driver_filter' => ['nullable', 'in:all,assigned,unassigned'],
            'truck_page' => ['nullable', 'integer', 'min:1'], 'driver_page' => ['nullable', 'integer', 'min:1'],
            'shipment_page' => ['nullable', 'integer', 'min:1'],
            'shipment_statuses' => ['nullable', 'string', 'regex:/^(all|none|(?:draft|ready|quoted|booked|offer_failed|in_transit|at_delivery_location|delivered|exception|failed|cancelled|returned)(?:,(?:draft|ready|quoted|booked|offer_failed|in_transit|at_delivery_location|delivered|exception|failed|cancelled|returned))*)$/'],
        ]);
        $readiness->reconcile($merchant->id);
        $timezone = $merchant->timezone ?: config('app.timezone', 'UTC');
        $todayStart = now($timezone)->startOfDay()->utc();
        $from = Carbon::parse($filters['from'] ?? now($timezone)->toDateString(), $timezone)->startOfDay()->utc();
        $to = Carbon::parse($filters['to'] ?? $filters['from'] ?? now($timezone)->toDateString(), $timezone)->endOfDay()->utc();
        $open = fn ($q) => $q->where('merchant_id', $merchant->id)->where('environment_id', $environment?->id)
            ->whereIn('status', ['draft', 'dispatched', 'in_progress']);
        $vehicles = Vehicle::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id);
        if ($search = $filters['truck_search'] ?? null) {
            $vehicles->where(fn ($q) => $q->where('plate_number', 'like', "%$search%")->orWhere('ref_code', 'like', "%$search%"));
        }
        if (($filters['fleet_status'] ?? 'active') !== 'all') {
            $vehicles->where('is_active', ($filters['fleet_status'] ?? 'active') === 'active');
        }
        $busy = fn ($q) => $q->whereIn('status', ['dispatched', 'in_progress']);
        if (($filters['availability'] ?? 'all') === 'busy') {
            $vehicles->whereHas('runs', $busy);
        }
        if (($filters['availability'] ?? 'all') === 'available') {
            $vehicles->where('is_active', true)->whereNull('maintenance_mode_at')->whereDoesntHave('runs', $busy);
        }
        $trucks = (clone $vehicles)->with(['runs' => function ($q) use ($open, $from, $to) {
            $open($q);
            $q->whereBetween('created_at', [$from, $to])
                ->with(['merchant', 'driver.user', 'vehicle', 'originLocation', 'destinationLocation', 'runShipments.shipment.pickupLocation', 'runShipments.shipment.dropoffLocation'])
                ->orderBy('planned_start_at')->orderBy('id');
        }])->withCount(['runs as occupied_count' => $busy])->orderBy('plate_number')->orderBy('id')->get();
        $drivers = Driver::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)->where('is_active', true)->with('user');
        if ($search = $filters['driver_search'] ?? null) {
            $drivers->whereHas('user', fn ($q) => $q->where(fn ($q) => $q->where('name', 'like', "%$search%")->orWhere('telephone', 'like', "%$search%")));
        }
        if (($filters['driver_filter'] ?? 'all') === 'assigned') {
            $drivers->whereHas('runs', $open);
        }
        if (($filters['driver_filter'] ?? 'all') === 'unassigned') {
            $drivers->whereDoesntHave('runs', $open);
        }
        $unassignedDrivers = (clone $drivers)->whereDoesntHave('runs', $open)->count();
        $drivers = $drivers->with(['runs' => function ($q) use ($open) {
            $open($q);
            $q->orderBy('planned_start_at')->orderBy('id');
        }])->withCount(['runs as assigned_count' => $open])->orderBy('id')->paginate(30, ['*'], 'driver_page');
        $shipments = Shipment::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)->where('environment_id', $environment?->id)
            ->whereDoesntHave('runShipments', fn ($q) => $q->where('status', '!=', RunShipment::STATUS_REMOVED)->whereHas('run', fn ($q) => $q->whereIn('status', ['draft', 'dispatched', 'in_progress'])))
            ->with(['pickupLocation', 'dropoffLocation']);
        $statuses = $filters['shipment_statuses'] ?? null;
        if ($statuses === 'none') {
            $shipments->whereRaw('1 = 0');
        } elseif ($statuses && $statuses !== 'all') {
            $shipments->whereIn('status', explode(',', $statuses));
        } elseif (! $statuses) {
            $shipments->whereNotIn('status', ['delivered', 'failed', 'cancelled', 'returned']);
        }
        if ($search = $filters['shipment_search'] ?? null) {
            $shipments->where(fn ($q) => $q->where('merchant_order_ref', 'like', "%$search%")->orWhere('delivery_note_number', 'like', "%$search%"));
        }
        $shipments = $shipments->orderBy('collection_date')->orderBy('id')->paginate(30, ['*'], 'shipment_page');
        $canManage = $request->user()->can('create', [Run::class, $merchant]);
        $summaryRuns = Run::whereIn('vehicle_id', (clone $vehicles)->select('vehicles.id'));
        $open($summaryRuns);
        $summaryRuns->whereBetween('created_at', [$from, $to]);

        return ApiResponse::success([
            'timezone' => $timezone, 'can_manage' => $canManage,
            'summary' => [
                'unassigned_drivers' => $unassignedDrivers,
                'available_trucks' => (clone $vehicles)->where('is_active', true)->whereNull('maintenance_mode_at')->whereDoesntHave('runs', $busy)->count(),
                'active_runs' => (clone $summaryRuns)->where('status', 'in_progress')->count(),
                'overdue_plans' => (clone $summaryRuns)->where('status', '!=', 'in_progress')->where('planned_start_at', '<', $todayStart)->count(),
                'unassigned_shipments' => $shipments->total(),
            ],
            'environments' => MerchantEnvironment::where('merchant_id', $merchant->id)->orderBy('name')->get()->map(fn ($e) => ['environment_id' => $e->uuid, 'name' => $e->name]),
            'trucks' => $trucks->map(fn ($vehicle) => [
                'vehicle_id' => $vehicle->uuid, 'plate_number' => $vehicle->plate_number, 'ref_code' => $vehicle->ref_code,
                'is_active' => (bool) $vehicle->is_active, 'available' => $vehicle->is_active && ! $vehicle->maintenance_mode_at && ! $vehicle->occupied_count,
                'can_create' => $canManage && $vehicle->is_active && ! $vehicle->maintenance_mode_at,
                'runs' => $vehicle->runs->map(fn ($run) => [
                    'run_id' => $run->uuid, 'status' => $run->status, 'schedule_managed' => (bool) $run->schedule_managed,
                    'planned_start_at' => $run->planned_start_at?->toIso8601String(), 'started_at' => $run->started_at?->toIso8601String(),
                    'overdue' => $run->status !== 'in_progress' && $run->planned_start_at && $run->planned_start_at < $todayStart,
                    'waiting_reason' => $readiness->waitingReason($run),
                    'can_assign_driver' => $canManage && $run->isMutable(), 'can_add_shipment' => $canManage,
                    'origin' => $this->location($run->originLocation), 'destination' => $this->location($run->destinationLocation),
                    'driver' => $run->driver ? ['driver_id' => $run->driver->uuid, 'name' => $run->driver->user?->name,
                        'profile_photo_url' => ProfilePhotoUrl::forPath($run->driver->user?->profile_photo_path)] : null,
                    'shipments' => $run->runShipments->where('status', '!=', RunShipment::STATUS_REMOVED)->sortBy(fn ($a) => $a->sequence ?? PHP_INT_MAX)->map(fn ($a) => $this->shipment($a->shipment, $run->uuid))->filter()->values(),
                ])->values(),
            ])->values(),
            'drivers' => $drivers->map(fn ($driver) => [
                'driver_id' => $driver->uuid, 'name' => $driver->user?->name, 'phone' => $driver->user?->telephone,
                'profile_photo_url' => ProfilePhotoUrl::forPath($driver->user?->profile_photo_path),
                'assigned' => $driver->assigned_count > 0,
                'assigned_runs' => $driver->runs->map(fn ($run) => ['run_id' => $run->uuid, 'status' => $run->status,
                    'planned_start_at' => $run->planned_start_at?->toIso8601String()])->values(),
            ])->values(),
            'shipments' => $shipments->map(fn ($shipment) => $this->shipment($shipment))->values(),
            'pagination' => ['trucks' => ['current_page' => 1, 'last_page' => 1, 'total' => $trucks->count()], 'drivers' => $this->page($drivers), 'shipments' => $this->page($shipments)],
        ]);
    }

    private function location($location): ?array
    {
        return $location ? ['location_id' => $location->uuid, 'name' => $location->name ?: $location->company ?: $location->full_address] : null;
    }

    private function shipment(?Shipment $shipment, ?string $runId = null): ?array
    {
        return $shipment ? ['shipment_id' => $shipment->uuid, 'reference' => $shipment->merchant_order_ref,
            'delivery_note_number' => $shipment->delivery_note_number, 'collection_date' => $shipment->collection_date?->toIso8601String(),
            'status' => $shipment->status, 'source_run_id' => $runId,
            'pickup' => $this->location($shipment->pickupLocation), 'dropoff' => $this->location($shipment->dropoffLocation)] : null;
    }

    public function createRun(StoreRunRequest $request, RunService $service, RunReadinessService $readiness)
    {
        [$merchant, $environment] = $this->context($request);
        $this->authorize('create', [Run::class, $merchant]);
        $data = $request->validated();
        abort_unless($data['schedule_managed'] ?? false, 422, 'This operation requires a scheduled plan.');
        abort_unless(count($data['shipment_ids'] ?? []) === 1 && ! empty($data['expected_source_run_id']), 422, 'Choose one shipment and its source run.');
        try {
            $run = DB::transaction(function () use ($data, $merchant, $environment, $service, $request) {
                Merchant::whereKey($merchant->id)->lockForUpdate()->firstOrFail();
                // RunService verifies the fingerprint on a retried creation request.
                if (Run::where('schedule_request_id', $data['schedule_request_id'])->exists()) {
                    return $service->createRun($data, $environment);
                }
                $source = Run::where('uuid', $data['expected_source_run_id'])->where('merchant_id', $merchant->id)
                    ->where('environment_id', $environment?->id)->lockForUpdate()->firstOrFail();
                $shipment = Shipment::where('uuid', $data['shipment_ids'][0])->where('merchant_id', $merchant->id)
                    ->where('environment_id', $environment?->id)->lockForUpdate()->firstOrFail();
                abort_unless($source->isMutable(), 409, 'The source run has started or closed.');
                $current = $shipment->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('run', fn ($q) => $q->whereIn('status', ['draft', 'dispatched', 'in_progress']))->first();
                abort_unless($current && $current->run_id === $source->id, 409, 'The shipment assignment changed. Refresh before moving it.');
                $service->detachShipment($source, $shipment->uuid);
                $run = $service->createRun($data, $environment);
                app(ActivityLogService::class)->log(action: 'schedule_shipment_transferred', entityType: 'shipment', entity: $shipment, actor: $request->user(),
                    changes: ['before' => ['run_id' => $source->uuid], 'after' => ['run_id' => $run->uuid]], title: 'Shipment moved to a new planned run');

                return $run;
            }, 5);
            $readiness->reconcile($merchant->id);

            return ApiResponse::success(['run_id' => $run->uuid], [], 201);
        } catch (HttpExceptionInterface $e) {
            return ApiResponse::error('SCHEDULE_CONFLICT', $e->getMessage(), [], $e->getStatusCode());
        } catch (Throwable $e) {
            return $this->apiError($e, 'SCHEDULE_CREATE_FAILED', 'Unable to create this plan.');
        }
    }

    public function transfer(Request $request, RunService $service, RunReadinessService $readiness)
    {
        [$merchant, $environment] = $this->context($request);
        $this->authorize('create', [Run::class, $merchant]);
        $data = $request->validate(['shipment_id' => ['required', 'uuid'], 'expected_source_run_id' => ['present', 'nullable', 'uuid'], 'target_run_id' => ['present', 'nullable', 'uuid']]);
        try {
            DB::transaction(function () use ($data, $merchant, $environment, $request, $service) {
                Merchant::whereKey($merchant->id)->lockForUpdate()->firstOrFail();
                $runs = Run::where('merchant_id', $merchant->id)->where('environment_id', $environment?->id)
                    ->whereIn('uuid', array_filter([$data['expected_source_run_id'], $data['target_run_id']]))->orderBy('id')->lockForUpdate()->get()->keyBy('uuid');
                foreach (array_filter([$data['expected_source_run_id'], $data['target_run_id']]) as $uuid) {
                    abort_unless($runs->has($uuid), 404, 'Run not found in this environment.');
                }
                $shipment = Shipment::where('uuid', $data['shipment_id'])->where('merchant_id', $merchant->id)
                    ->where('environment_id', $environment?->id)->lockForUpdate()->firstOrFail();
                abort_if(in_array($shipment->status, ['delivered', 'failed', 'cancelled', 'returned']), 422, 'This shipment is already finished.');
                $assignment = $shipment->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('run', fn ($q) => $q->whereIn('status', ['draft', 'dispatched', 'in_progress']))->with('run')->lockForUpdate()->first();
                $source = $assignment?->run;
                // Repeating an already-successful move is safe.
                if ($source?->uuid === $data['target_run_id']) {
                    return;
                }
                abort_unless($source?->uuid === $data['expected_source_run_id'], 409, 'This shipment assignment changed. Refresh before moving it.');
                abort_if($source && ! $source->isMutable(), 409, 'Shipments on active runs cannot be moved.');
                $target = $data['target_run_id'] ? $runs[$data['target_run_id']] : null;
                abort_if($target && ! in_array($target->status, ['draft', 'dispatched', 'in_progress']), 409, 'The target run is closed.');
                // Moves originating in a plan target another plan; unassigned work can join active runs.
                abort_if($source && $target && ! $target->isMutable(), 409, 'Move planned shipments to another planned run.');
                if ($source) {
                    $service->detachShipment($source, $shipment->uuid);
                }
                if ($target) {
                    $service->attachShipments($target, [$shipment->uuid], allowInProgress: true);
                }
                app(ActivityLogService::class)->log(action: 'schedule_shipment_transferred', entityType: 'shipment', entity: $shipment, actor: $request->user(),
                    changes: ['before' => ['run_id' => $source?->uuid], 'after' => ['run_id' => $target?->uuid]], title: 'Schedule shipment assignment changed');
            }, 5);
            $readiness->reconcile($merchant->id);

            return ApiResponse::success(['shipment_id' => $data['shipment_id'], 'run_id' => $data['target_run_id']]);
        } catch (HttpExceptionInterface $e) {
            return ApiResponse::error('SCHEDULE_CONFLICT', $e->getMessage(), [], $e->getStatusCode());
        } catch (Throwable $e) {
            return $this->apiError($e, 'SCHEDULE_TRANSFER_FAILED', 'Unable to move the shipment.');
        }
    }
}
