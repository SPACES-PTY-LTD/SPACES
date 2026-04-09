<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreatedOverTimeReportRequest;
use App\Http\Requests\DashboardStatsReportRequest;
use App\Http\Requests\DocumentComplianceReportRequest;
use App\Http\Requests\FleetStatusReportRequest;
use App\Http\Requests\MappedBookingsReportRequest;
use App\Http\Requests\MissingDocumentsReportRequest;
use App\Http\Requests\RouteWaitingTimesReportRequest;
use App\Http\Requests\ShipmentsByLocationReportRequest;
use App\Http\Resources\LocationResource;
use App\Http\Resources\MappedBookingReportResource;
use App\Http\Resources\VehicleActivityResource;
use App\Models\Booking;
use App\Models\Driver;
use App\Models\EntityFile;
use App\Models\FileType;
use App\Models\Merchant;
use App\Models\Quote;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\VehicleService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator as PaginationLengthAwarePaginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class ReportController extends Controller
{
    private const ACTIVE_MAPPED_BOOKING_STATUSES = [
        'booked',
        'in_transit',
    ];

    public function shipmentsFullReport(Request $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $merchantUuid = $request->get('merchant_id');

            if (empty($merchantUuid) && !$environment) {
                throw ValidationException::withMessages([
                    'merchant_id' => 'The merchant_id field is required.',
                ]);
            }

            $latestRunShipmentSub = RunShipment::query()
                ->selectRaw('shipment_id, MAX(id) as latest_run_shipment_id')
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->groupBy('shipment_id');

            $parcelWeightColumn = Schema::hasColumn('shipment_parcels', 'weight')
                ? 'weight'
                : 'weight_kg';
            $parcelTotalsSub = DB::table('shipment_parcels')
                ->selectRaw("shipment_id, COALESCE(SUM({$parcelWeightColumn}), 0) as delivered_volume_order")
                ->whereNull('deleted_at')
                ->groupBy('shipment_id');

            $query = $this->applyShipmentScope(
                Shipment::query()
                    ->select('shipments.*')
                    ->leftJoinSub($latestRunShipmentSub, 'latest_run_shipment', function ($join) {
                        $join->on('latest_run_shipment.shipment_id', '=', 'shipments.id');
                    })
                    ->leftJoin('run_shipments as lrs', 'lrs.id', '=', 'latest_run_shipment.latest_run_shipment_id')
                    ->leftJoin('runs as lr', 'lr.id', '=', 'lrs.run_id')
                    ->leftJoin('vehicles as report_vehicles', 'report_vehicles.id', '=', 'lr.vehicle_id')
                    ->leftJoin('drivers as report_drivers', 'report_drivers.id', '=', 'lr.driver_id')
                    ->leftJoin('users as report_driver_users', 'report_driver_users.id', '=', 'report_drivers.user_id')
                    ->leftJoin('locations as report_pickup_locations', 'report_pickup_locations.id', '=', 'shipments.pickup_location_id')
                    ->leftJoin('locations as report_dropoff_locations', 'report_dropoff_locations.id', '=', 'shipments.dropoff_location_id')
                    ->leftJoinSub($parcelTotalsSub, 'parcel_totals', function ($join) {
                        $join->on('parcel_totals.shipment_id', '=', 'shipments.id');
                    })
                    ->with([
                        'merchant',
                        'pickupLocation',
                        'dropoffLocation',
                        'parcels',
                        'runShipments' => function ($builder) {
                            $builder->where('status', '!=', RunShipment::STATUS_REMOVED)
                                ->with(['run.driver.user', 'run.vehicle'])
                                ->orderByDesc('id');
                        },
                    ]),
                $environment,
                $user
            );

            if (!empty($merchantUuid)) {
                $merchantId = Merchant::query()
                    ->where('uuid', (string) $merchantUuid)
                    ->value('id');
                $query->where('shipments.merchant_id', $merchantId ?? 0);
            } elseif ($environment) {
                $query->where('shipments.merchant_id', $environment->merchant_id);
            }

            if (!empty($request->get('date_created'))) {
                $query->whereDate('shipments.created_at', $request->get('date_created'));
            }

            if (!empty($request->get('created_from'))) {
                $query->whereDate('shipments.created_at', '>=', $request->get('created_from'));
            }

            if (!empty($request->get('created_to'))) {
                $query->whereDate('shipments.created_at', '<=', $request->get('created_to'));
            }

            if (!empty($request->get('collection_date'))) {
                $query->whereDate('shipments.collection_date', $request->get('collection_date'));
            }

            if (!empty($request->get('shipment_number'))) {
                $query->where('shipments.merchant_order_ref', 'like', '%' . $request->get('shipment_number') . '%');
            }

            if (!empty($request->get('delivery_note_number'))) {
                $query->where('shipments.delivery_note_number', 'like', '%' . $request->get('delivery_note_number') . '%');
            }

            if (!empty($request->get('truck_plate_number'))) {
                $query->where('report_vehicles.plate_number', 'like', '%' . $request->get('truck_plate_number') . '%');
            }

            if (!empty($request->get('driver_id'))) {
                $query->where('report_drivers.uuid', $request->get('driver_id'));
            }

            if (!empty($request->get('from_location_id'))) {
                $query->where('report_pickup_locations.uuid', $request->get('from_location_id'));
            }

            if (!empty($request->get('to_location_id'))) {
                $query->where('report_dropoff_locations.uuid', $request->get('to_location_id'));
            }

            if (!empty($request->get('location_tag_id'))) {
                $locationTagId = $request->get('location_tag_id');
                $query->where(function (Builder $builder) use ($locationTagId) {
                    $builder
                        ->whereHas('pickupLocation.tags', function (Builder $tagQuery) use ($locationTagId) {
                            $tagQuery->where('tags.uuid', $locationTagId);
                        })
                        ->orWhereHas('dropoffLocation.tags', function (Builder $tagQuery) use ($locationTagId) {
                            $tagQuery->where('tags.uuid', $locationTagId);
                        });
                });
            }

            if (!empty($request->get('vehicle_tag_id'))) {
                $vehicleTagId = $request->get('vehicle_tag_id');
                $query->whereExists(function ($subquery) use ($vehicleTagId) {
                    $subquery
                        ->selectRaw('1')
                        ->from('taggables as report_vehicle_tag_filter_taggables')
                        ->join(
                            'tags as report_vehicle_tag_filter_tags',
                            'report_vehicle_tag_filter_tags.id',
                            '=',
                            'report_vehicle_tag_filter_taggables.tag_id'
                        )
                        ->whereColumn('report_vehicle_tag_filter_taggables.taggable_id', 'report_vehicles.id')
                        ->where('report_vehicle_tag_filter_taggables.taggable_type', Vehicle::class)
                        ->where('report_vehicle_tag_filter_tags.uuid', $vehicleTagId);
                });
            }

            if (!empty($request->get('shipment_status'))) {
                $query->where('shipments.status', $request->get('shipment_status'));
            }

            $sortBy = (string) $request->get('sort_by', 'date_created');
            $sortDirection = strtolower((string) $request->get('sort_direction', 'desc'));
            if (!in_array($sortDirection, ['asc', 'desc'], true)) {
                $sortDirection = 'desc';
            }

            $sortableColumns = [
                'date_created' => 'shipments.created_at',
                'collection_date' => 'shipments.collection_date',
                'shipment_number' => 'shipments.merchant_order_ref',
                'delivery_note_number' => 'shipments.delivery_note_number',
                'truck_plate_number' => 'report_vehicles.plate_number',
                'driver_name' => 'report_driver_users.name',
                'shipment_status' => 'shipments.status',
                'delivered_volume' => DB::raw('COALESCE(parcel_totals.delivered_volume_order, 0)'),
            ];

            $sortColumn = $sortableColumns[$sortBy] ?? 'shipments.created_at';
            $query->orderBy($sortColumn, $sortDirection)
                ->orderByDesc('shipments.id');

            $perPage = min((int) ($request->get('per_page', 50)), 200);
            $shipments = $query->paginate($perPage);
            $stageActivityMap = $this->buildShipmentStageActivityMap($shipments, $request);
            $visitMap = $this->buildShipmentLocationVisitMap($shipments, $request);

            $rows = $shipments->getCollection()->map(function (Shipment $shipment) use ($stageActivityMap, $visitMap, $request) {
                $runShipments = $shipment->relationLoaded('runShipments')
                    ? $shipment->getRelation('runShipments')
                    : $shipment->runShipments()
                        ->where('status', '!=', RunShipment::STATUS_REMOVED)
                        ->with(['run.driver.user', 'run.vehicle'])
                        ->orderByDesc('id')
                        ->get();
                $runShipment = $runShipments instanceof \Illuminate\Support\Collection
                    ? $runShipments->first()
                    : null;
                $run = $runShipment?->run;

                $fromVisit = $stageActivityMap[$shipment->id . ':' . VehicleActivity::EVENT_SHIPMENT_COLLECTION]
                    ?? ($visitMap[$shipment->id . ':' . $shipment->pickup_location_id] ?? null);
                $toVisit = $stageActivityMap[$shipment->id . ':' . VehicleActivity::EVENT_SHIPMENT_DELIVERY]
                    ?? ($visitMap[$shipment->id . ':' . $shipment->dropoff_location_id] ?? null);

                return [
                    'date_created' => optional($shipment->created_at)?->toIso8601String(),
                    'collection_date' => optional($shipment->collection_date)?->toIso8601String(),
                    'shipment_number' => $shipment->merchant_order_ref,
                    "shipment_id" => $shipment->uuid,
                    'delivery_note_number' => $shipment->delivery_note_number,
                    'truck_plate_number' => $run?->vehicle?->plate_number,
                    'vehicle_id' => $run?->vehicle?->uuid,
                    'driver' => $run?->driver?->user?->name,
                    'driver_id' => $run?->driver?->uuid,
                    'shipment_type' => $shipment->service_type,
                    'from_location' => $shipment->pickupLocation
                        ? (new LocationResource($shipment->pickupLocation))->toArray($request)
                        : null,
                    'from_vehicle_activity' => $fromVisit['activity'] ?? null,
                    'from_time_in' => $fromVisit['time_in'] ?? null,
                    'from_time_to' => $fromVisit['time_out'] ?? null,
                    'from_time_out' => $fromVisit['time_out'] ?? null,
                    'to_location' => $shipment->dropoffLocation
                        ? (new LocationResource($shipment->dropoffLocation))->toArray($request)
                        : null,
                    'to_vehicle_activity' => $toVisit['activity'] ?? null,
                    'to_time_in' => $toVisit['time_in'] ?? null,
                    'to_time_out' => $toVisit['time_out'] ?? null,
                    'shipment_status' => $shipment->status,
                    'delivered_volume' => $shipment->status === 'delivered'
                        ? $this->formatDeliveredVolume($shipment)
                        : null,
                ];
            })->values();

            return ApiResponse::success($rows, [
                'current_page' => $shipments->currentPage(),
                'per_page' => $shipments->perPage(),
                'total' => $shipments->total(),
                'last_page' => $shipments->lastPage(),
            ]);
        } catch (Throwable $e) {
            Log::error('Reports shipments_full_report failed', [
                'request_id' => ApiResponse::requestId(),
                'exception_file' => $e->getFile(),
                'exception_line' => $e->getLine(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function createdOverTime(CreatedOverTimeReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $merchantId = null;

            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()
                    ->where('uuid', $validated['merchant_id'])
                    ->value('id');
            }

            [$start, $end] = $this->resolveDateRange($request, $environment, $user);
            if (!$start || !$end) {
                return ApiResponse::success([]);
            }

            $dateSeries = $this->buildDateSeries($start, $end);

            $quotedCounts = $this->countByDate(
                $this->applyQuoteScope(Quote::query(), $environment, $user)
                    ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId)),
                $start,
                $end
            );

            $shippedCounts = $this->countByDate(
                $this->applyShipmentScope(Shipment::query(), $environment, $user)
                    ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId)),
                $start,
                $end
            );

            $bookedCounts = $this->countByDate(
                $this->applyBookingScope(Booking::query(), $environment, $user)
                    ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId)),
                $start,
                $end
            );

            $results = [];
            foreach ($dateSeries as $date) {
                $results[] = [
                    'date' => $date,
                    'quoted' => (int) ($quotedCounts[$date] ?? 0),
                    'shiped' => (int) ($shippedCounts[$date] ?? 0),
                    'booked' => (int) ($bookedCounts[$date] ?? 0),
                ];
            }

            return ApiResponse::success($results);
        } catch (Throwable $e) {
            Log::error('Reports created_over_time failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function dashboardStats(DashboardStatsReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $merchantId = null;

            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()
                    ->where('uuid', $validated['merchant_id'])
                    ->value('id');
            }

            $totalShipments = $this->applyShipmentScope(Shipment::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->count();
            $inTransitBookings = $this->applyBookingScope(Booking::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->where('status', 'in_transit')
                ->count();
            $pendingShipments = $this->applyShipmentScope(Shipment::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->where('status', 'draft')
                ->count();
            $deliveredShipments = $this->applyShipmentScope(Shipment::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->where('status', 'delivered')
                ->count();
            $activeQuotes = $this->applyQuoteScope(Quote::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->where('status', 'created')
                ->count();
            $activeMerchants = $this->applyMerchantScope(Merchant::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('id', $merchantId))
                ->where('status', 'active')
                ->count();
            $vehiclesCount = $this->applyVehicleScope(Vehicle::query(), $environment, $user)
                ->when($merchantId, fn (Builder $query) => $query->where('merchant_id', $merchantId))
                ->count();
            $totalMembers = $this->applyUserScope(User::query(), $environment, $user)
                ->when($merchantId, function (Builder $query) use ($merchantId) {
                    $query->whereHas('merchants', function (Builder $builder) use ($merchantId) {
                        $builder->where('merchants.id', $merchantId);
                    });
                })
                ->count();

            return ApiResponse::success([
                'total_shipments' => (int) $totalShipments,
                'in_transit_bookings' => (int) $inTransitBookings,
                'pending_shipments' => (int) $pendingShipments,
                'delivered_shipments' => (int) $deliveredShipments,
                'active_merchants' => (int) $activeMerchants,
                'active_quotes' => (int) $activeQuotes,
                'vehicles_count' => (int) $vehiclesCount,
                'total_members' => (int) $totalMembers,
            ]);
        } catch (Throwable $e) {
            Log::error('Reports dashboard_stats failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function fleetStatus(FleetStatusReportRequest $request, VehicleService $vehicleService)
    {
        try {
            return ApiResponse::success(
                $vehicleService->buildFleetStatusSummary($request->user(), $request->validated())
            );
        } catch (Throwable $e) {
            Log::error('Reports fleet_status failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function missingDocuments(MissingDocumentsReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $perPage = min((int) ($validated['per_page'] ?? 100), 200);

            $merchantScope = $this->applyMerchantScope(Merchant::query(), $environment, $user);
            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()->where('uuid', $validated['merchant_id'])->value('id');
                if (!$merchantId) {
                    return ApiResponse::success([], [
                        'current_page' => 1,
                        'per_page' => $perPage,
                        'total' => 0,
                        'last_page' => 1,
                        'summary_by_type' => [],
                    ]);
                }
                $merchantScope->where('id', $merchantId);
            }

            $accessibleMerchants = $merchantScope
                ->select('id', 'uuid', 'name', 'account_id')
                ->get();

            if ($accessibleMerchants->isEmpty()) {
                return ApiResponse::success([], [
                    'current_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                    'last_page' => 1,
                    'summary_by_type' => [],
                ]);
            }

            $merchantIds = $accessibleMerchants->pluck('id')->all();
            $accountIds = $accessibleMerchants->pluck('account_id')->filter()->unique()->values()->all();
            $entityTypes = !empty($validated['entity_type'])
                ? [(string) $validated['entity_type']]
                : FileType::ENTITY_TYPES;

            $baseQuery = $this->buildMissingDocumentsBaseQuery(
                merchantIds: $merchantIds,
                accountIds: $accountIds,
                entityTypes: $entityTypes,
            );

            $sortBy = (string) ($validated['sort_by'] ?? 'merchant_name');
            $sortDir = strtolower((string) ($validated['sort_dir'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
            $sortColumns = [
                'merchant_name' => 'merchant_name',
                'entity_type' => 'entity_type',
                'entity_label' => 'entity_label',
                'file_type_name' => 'file_type_name',
            ];
            $sortColumn = $sortColumns[$sortBy] ?? 'merchant_name';

            $rowsQuery = DB::query()
                ->fromSub($baseQuery, 'missing_docs')
                ->orderBy($sortColumn, $sortDir)
                ->orderBy('merchant_name')
                ->orderBy('entity_type')
                ->orderBy('file_type_name')
                ->orderBy('entity_label');

            $rows = $rowsQuery->paginate($perPage);

            $summary = DB::query()
                ->fromSub($baseQuery, 'missing_docs')
                ->selectRaw('merchant_id, merchant_name, entity_type, file_type_id, file_type_name, COUNT(*) as missing_count')
                ->groupBy('merchant_id', 'merchant_name', 'entity_type', 'file_type_id', 'file_type_name')
                ->orderByDesc('missing_count')
                ->orderBy('merchant_name')
                ->orderBy('file_type_name')
                ->limit(100)
                ->get();

            return ApiResponse::success($rows->items(), [
                'current_page' => $rows->currentPage(),
                'per_page' => $rows->perPage(),
                'total' => $rows->total(),
                'last_page' => $rows->lastPage(),
                'summary_by_type' => $summary,
            ]);
        } catch (Throwable $e) {
            Log::error('Reports missing_documents failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function documentExpiry(DocumentComplianceReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();

            $accessibleMerchants = $this->resolveAccessibleMerchants(
                environment: $environment,
                user: $user,
                merchantUuid: $validated['merchant_id'] ?? null
            );

            $perPage = min((int) ($validated['per_page'] ?? 100), 200);
            if ($accessibleMerchants->isEmpty()) {
                return ApiResponse::success([], [
                    'current_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                    'last_page' => 1,
                ]);
            }

            $merchantIds = $accessibleMerchants->pluck('id')->all();
            $expiringInDays = (int) ($validated['expiring_in_days'] ?? 30);
            $status = $validated['status'] ?? null;
            $entityType = $validated['entity_type'] ?? null;

            $expiryCutoff = now()->copy()->addDays($expiringInDays);
            $query = $this->buildDocumentExpiryBaseQuery($merchantIds, $entityType);

            if ($status === 'expired') {
                $query->where('ef.expires_at', '<=', now());
            } elseif ($status === 'expiring') {
                $query->where('ef.expires_at', '>', now())
                    ->where('ef.expires_at', '<=', $expiryCutoff);
            } else {
                $query->where('ef.expires_at', '<=', $expiryCutoff);
            }

            $sortBy = (string) ($validated['sort_by'] ?? 'expires_at');
            $sortDir = strtolower((string) ($validated['sort_dir'] ?? 'asc')) === 'desc' ? 'desc' : 'asc';
            $sortableColumns = [
                'merchant_name' => 'merchant_name',
                'entity_type' => 'entity_type',
                'entity_label' => 'entity_label',
                'file_type_name' => 'file_type_name',
                'original_name' => 'ef.original_name',
                'uploaded_at' => 'ef.created_at',
                'expires_at' => 'ef.expires_at',
                'days_to_expiry' => 'ef.expires_at',
            ];
            $sortColumn = $sortableColumns[$sortBy] ?? 'ef.expires_at';

            $paginator = $query
                ->orderBy($sortColumn, $sortDir)
                ->orderBy('ef.expires_at')
                ->orderBy('merchant_name')
                ->paginate($perPage);

            $rows = collect($paginator->items())->map(function ($row) {
                $expiresAt = $row->expires_at ? Carbon::parse($row->expires_at) : null;
                $daysToExpiry = $expiresAt ? now()->startOfDay()->diffInDays($expiresAt->startOfDay(), false) : null;

                return [
                    'merchant_id' => $row->merchant_id,
                    'merchant_name' => $row->merchant_name,
                    'entity_type' => $row->entity_type,
                    'file_type_id' => $row->file_type_id,
                    'file_type_name' => $row->file_type_name,
                    'entity_id' => $row->entity_id,
                    'entity_label' => $row->entity_label,
                    'file_id' => $row->file_id,
                    'original_name' => $row->original_name,
                    'uploaded_at' => $row->uploaded_at ? Carbon::parse($row->uploaded_at)->toIso8601String() : null,
                    'expires_at' => $expiresAt?->toIso8601String(),
                    'days_to_expiry' => $daysToExpiry,
                    'expiry_status' => $daysToExpiry !== null && $daysToExpiry < 0 ? 'expired' : 'expiring',
                ];
            })->values();

            return ApiResponse::success($rows, [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ]);
        } catch (Throwable $e) {
            Log::error('Reports document_expiry failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function documentCoverage(DocumentComplianceReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $perPage = min((int) ($validated['per_page'] ?? 100), 200);
            $page = max((int) ($validated['page'] ?? 1), 1);
            $entityTypeFilter = $validated['entity_type'] ?? null;
            $sortBy = (string) ($validated['sort_by'] ?? 'missing_count');
            $sortDir = strtolower((string) ($validated['sort_dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

            $accessibleMerchants = $this->resolveAccessibleMerchants(
                environment: $environment,
                user: $user,
                merchantUuid: $validated['merchant_id'] ?? null
            );

            if ($accessibleMerchants->isEmpty()) {
                return ApiResponse::success([], [
                    'current_page' => 1,
                    'per_page' => $perPage,
                    'total' => 0,
                    'last_page' => 1,
                ]);
            }

            $merchantIds = $accessibleMerchants->pluck('id')->all();
            $accountIds = $accessibleMerchants->pluck('account_id')->filter()->unique()->values()->all();
            $entityTypes = $entityTypeFilter ? [$entityTypeFilter] : FileType::ENTITY_TYPES;

            $fileTypes = FileType::query()
                ->whereIn('merchant_id', $merchantIds)
                ->where('is_active', true)
                ->whereIn('entity_type', $entityTypes)
                ->orderBy('entity_type')
                ->orderBy('sort_order')
                ->orderBy('name')
                ->get(['id', 'uuid', 'merchant_id', 'entity_type', 'name']);

            $requiredCounts = $this->entityRequiredCountsByMerchant($merchantIds, $accountIds);

            $uploadedCounts = EntityFile::query()
                ->whereIn('merchant_id', $merchantIds)
                ->whereIn('file_type_id', $fileTypes->pluck('id')->all())
                ->whereNull('deleted_at')
                ->selectRaw('file_type_id, COUNT(DISTINCT attachable_id) as uploaded_count')
                ->groupBy('file_type_id')
                ->pluck('uploaded_count', 'file_type_id');

            $expiredCounts = EntityFile::query()
                ->whereIn('merchant_id', $merchantIds)
                ->whereIn('file_type_id', $fileTypes->pluck('id')->all())
                ->whereNull('deleted_at')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<=', now())
                ->selectRaw('file_type_id, COUNT(DISTINCT attachable_id) as expired_count')
                ->groupBy('file_type_id')
                ->pluck('expired_count', 'file_type_id');

            $merchantMap = $accessibleMerchants->keyBy('id');

            $rows = $fileTypes->map(function (FileType $fileType) use ($requiredCounts, $uploadedCounts, $expiredCounts, $merchantMap) {
                $required = (int) ($requiredCounts[$fileType->merchant_id][$fileType->entity_type] ?? 0);
                $uploaded = min((int) ($uploadedCounts[$fileType->id] ?? 0), $required);
                $expired = min((int) ($expiredCounts[$fileType->id] ?? 0), $uploaded);
                $missing = max($required - $uploaded, 0);
                $compliance = $required > 0 ? round(($uploaded / $required) * 100, 1) : null;

                return [
                    'merchant_id' => $merchantMap[$fileType->merchant_id]?->uuid,
                    'merchant_name' => $merchantMap[$fileType->merchant_id]?->name,
                    'entity_type' => $fileType->entity_type,
                    'file_type_id' => $fileType->uuid,
                    'file_type_name' => $fileType->name,
                    'required_count' => $required,
                    'uploaded_count' => $uploaded,
                    'missing_count' => $missing,
                    'expired_count' => $expired,
                    'compliance_percent' => $compliance,
                ];
            });

            $sortableColumns = [
                'merchant_name' => 'merchant_name',
                'entity_type' => 'entity_type',
                'file_type_name' => 'file_type_name',
                'required_count' => 'required_count',
                'uploaded_count' => 'uploaded_count',
                'missing_count' => 'missing_count',
                'expired_count' => 'expired_count',
                'compliance_percent' => 'compliance_percent',
            ];
            $sortColumn = $sortableColumns[$sortBy] ?? 'missing_count';
            $rows = $rows->sort(function (array $a, array $b) use ($sortColumn, $sortDir): int {
                $aValue = $a[$sortColumn] ?? null;
                $bValue = $b[$sortColumn] ?? null;

                if (is_numeric($aValue) && is_numeric($bValue)) {
                    $comparison = $aValue <=> $bValue;
                } else {
                    $comparison = strcasecmp((string) $aValue, (string) $bValue);
                }

                if ($comparison === 0) {
                    $comparison = strcasecmp((string) ($a['merchant_name'] ?? ''), (string) ($b['merchant_name'] ?? ''));
                }
                if ($comparison === 0) {
                    $comparison = strcasecmp((string) ($a['entity_type'] ?? ''), (string) ($b['entity_type'] ?? ''));
                }
                if ($comparison === 0) {
                    $comparison = strcasecmp((string) ($a['file_type_name'] ?? ''), (string) ($b['file_type_name'] ?? ''));
                }

                return $sortDir === 'asc' ? $comparison : -$comparison;
            })->values();

            $total = $rows->count();
            $items = $rows->slice(($page - 1) * $perPage, $perPage)->values()->all();
            $paginator = new PaginationLengthAwarePaginator(
                items: $items,
                total: $total,
                perPage: $perPage,
                currentPage: $page,
                options: ['path' => $request->url(), 'query' => $request->query()]
            );

            return ApiResponse::success($paginator->items(), [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ]);
        } catch (Throwable $e) {
            Log::error('Reports document_coverage failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function shipmentsByLocation(ShipmentsByLocationReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $locationType = $validated['location_type'] ?? 'pickup';
            $dateRange = $validated['date_range'] ?? '1month';
            $locationColumn = $locationType === 'dropoff'
                ? 'shipments.dropoff_location_id'
                : 'shipments.pickup_location_id';

            $merchantId = null;
            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()
                    ->where('uuid', $validated['merchant_id'])
                    ->value('id');
            }

            [$start, $end] = $this->resolveDateRange($request, $environment, $user);
            if (!$start || !$end) {
                return ApiResponse::success([], [
                    'total_locations' => 0,
                    'total_shipments' => 0,
                    'date_range' => $dateRange,
                    'location_type' => $locationType,
                ]);
            }

            $rows = $this->applyShipmentScope(
                Shipment::query(),
                $environment,
                $user
            )
                ->leftJoin('locations as report_locations', function ($join) use ($locationColumn) {
                    $join->on('report_locations.id', '=', $locationColumn)
                        ->whereNull('report_locations.deleted_at');
                })
                ->when($merchantId, fn (Builder $query) => $query->where('shipments.merchant_id', $merchantId))
                ->whereBetween('shipments.created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
                ->selectRaw("
                    report_locations.uuid as location_id,
                    COALESCE(
                        NULLIF(report_locations.name, ''),
                        NULLIF(report_locations.company, ''),
                        NULLIF(report_locations.code, ''),
                        'Unknown location'
                    ) as location_name,
                    report_locations.city as city,
                    COUNT(*) as total_shipments
                ")
                ->groupBy(
                    'report_locations.uuid',
                    'report_locations.name',
                    'report_locations.company',
                    'report_locations.code',
                    'report_locations.city'
                )
                ->orderByDesc('total_shipments')
                ->orderBy('location_name')
                ->get()
                ->map(function ($row) {
                    return [
                        'location_id' => $row->location_id,
                        'location_name' => $row->location_name,
                        'city' => $row->city,
                        'total_shipments' => (int) $row->total_shipments,
                    ];
                })
                ->values();

            return ApiResponse::success($rows, [
                'total_locations' => $rows->count(),
                'total_shipments' => (int) $rows->sum('total_shipments'),
                'date_range' => $dateRange,
                'location_type' => $locationType,
            ]);
        } catch (Throwable $e) {
            Log::error('Reports shipments_by_location failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function routeWaitingTimes(RouteWaitingTimesReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();
            $dateRange = $validated['date_range'] ?? '1month';

            $merchantId = null;
            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()
                    ->where('uuid', $validated['merchant_id'])
                    ->value('id');
            }

            [$start, $end] = $this->resolveDateRange($request, $environment, $user);
            if (!$start || !$end) {
                return ApiResponse::success([], [
                    'total_routes' => 0,
                    'total_shipments' => 0,
                    'date_range' => $dateRange,
                ]);
            }

            $aggregates = [];
            $totalShipments = 0;

            $query = $this->applyShipmentScope(
                Shipment::query()
                    ->select([
                        'shipments.id',
                        'shipments.uuid',
                        'shipments.created_at',
                        'shipments.pickup_location_id',
                        'shipments.dropoff_location_id',
                    ])
                    ->with([
                        'pickupLocation:id,uuid,name,code,company',
                        'dropoffLocation:id,uuid,name,code,company',
                    ]),
                $environment,
                $user
            )
                ->when($merchantId, fn (Builder $builder) => $builder->where('shipments.merchant_id', $merchantId))
                ->whereBetween('shipments.created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
                ->where(function (Builder $builder) {
                    $builder
                        ->whereNotNull('shipments.pickup_location_id')
                        ->orWhereNotNull('shipments.dropoff_location_id');
                })
                ->orderBy('shipments.id');

            $query->chunkById(500, function (Collection $shipments) use (&$aggregates, &$totalShipments) {
                $stageActivityMap = $this->buildShipmentStageActivityMapForCollection($shipments);
                $visitMap = $this->buildShipmentLocationVisitMapForCollection($shipments);

                foreach ($shipments as $shipment) {
                    $pickupLocation = $shipment->pickupLocation;
                    $dropoffLocation = $shipment->dropoffLocation;

                    if (!$pickupLocation && !$dropoffLocation) {
                        continue;
                    }

                    $fromLocationKey = $pickupLocation?->uuid ?? ($pickupLocation?->name ?: 'unknown-from');
                    $toLocationKey = $dropoffLocation?->uuid ?? ($dropoffLocation?->name ?: 'unknown-to');
                    $routeKey = $fromLocationKey . '::' . $toLocationKey;

                    $fromVisit = $stageActivityMap[$shipment->id . ':' . VehicleActivity::EVENT_SHIPMENT_COLLECTION]
                        ?? ($visitMap[$shipment->id . ':' . $shipment->pickup_location_id] ?? null);
                    $toVisit = $stageActivityMap[$shipment->id . ':' . VehicleActivity::EVENT_SHIPMENT_DELIVERY]
                        ?? ($visitMap[$shipment->id . ':' . $shipment->dropoff_location_id] ?? null);

                    $pickupWait = $this->diffInMinutesOrNull($fromVisit['time_in'] ?? null, $fromVisit['time_out'] ?? null);
                    $dropoffWait = $this->diffInMinutesOrNull($toVisit['time_in'] ?? null, $toVisit['time_out'] ?? null);
                    $transit = $this->diffInMinutesOrNull($fromVisit['time_out'] ?? null, $toVisit['time_in'] ?? null);
                    $latestAt = collect([
                        $toVisit['time_out'] ?? null,
                        $toVisit['time_in'] ?? null,
                        $fromVisit['time_out'] ?? null,
                        $fromVisit['time_in'] ?? null,
                        optional($shipment->created_at)?->toIso8601String(),
                    ])->filter()->max();

                    if (!array_key_exists($routeKey, $aggregates)) {
                        $aggregates[$routeKey] = [
                            'route_key' => $routeKey,
                            'route_label' => $this->formatRouteLocationLabel($pickupLocation)
                                . ' -> '
                                . $this->formatRouteLocationLabel($dropoffLocation),
                            'from_location_id' => $pickupLocation?->uuid,
                            'to_location_id' => $dropoffLocation?->uuid,
                            'shipment_count' => 0,
                            'pickup_wait_total' => 0.0,
                            'pickup_wait_count' => 0,
                            'dropoff_wait_total' => 0.0,
                            'dropoff_wait_count' => 0,
                            'transit_total' => 0.0,
                            'transit_count' => 0,
                            'latest_activity_at' => null,
                        ];
                    }

                    $aggregates[$routeKey]['shipment_count'] += 1;
                    $totalShipments += 1;

                    if ($pickupWait !== null) {
                        $aggregates[$routeKey]['pickup_wait_total'] += $pickupWait;
                        $aggregates[$routeKey]['pickup_wait_count'] += 1;
                    }

                    if ($dropoffWait !== null) {
                        $aggregates[$routeKey]['dropoff_wait_total'] += $dropoffWait;
                        $aggregates[$routeKey]['dropoff_wait_count'] += 1;
                    }

                    if ($transit !== null) {
                        $aggregates[$routeKey]['transit_total'] += $transit;
                        $aggregates[$routeKey]['transit_count'] += 1;
                    }

                    if (
                        !$aggregates[$routeKey]['latest_activity_at']
                        || strtotime((string) $latestAt) > strtotime((string) $aggregates[$routeKey]['latest_activity_at'])
                    ) {
                        $aggregates[$routeKey]['latest_activity_at'] = $latestAt;
                    }
                }
            }, 'shipments.id');

            $rows = collect($aggregates)
                ->map(function (array $row) {
                    return [
                        'route_key' => $row['route_key'],
                        'route_label' => $row['route_label'],
                        'shipment_count' => (int) $row['shipment_count'],
                        'avg_pickup_wait_minutes' => $this->averageMinutes($row['pickup_wait_total'], $row['pickup_wait_count']),
                        'avg_dropoff_wait_minutes' => $this->averageMinutes($row['dropoff_wait_total'], $row['dropoff_wait_count']),
                        'avg_transit_minutes' => $this->averageMinutes($row['transit_total'], $row['transit_count']),
                        'latest_activity_at' => $row['latest_activity_at'],
                        'from_location_id' => $row['from_location_id'],
                        'to_location_id' => $row['to_location_id'],
                    ];
                })
                ->sortByDesc(function (array $row) {
                    return ($row['avg_pickup_wait_minutes'] ?? 0) + ($row['avg_dropoff_wait_minutes'] ?? 0);
                })
                ->values();

            return ApiResponse::success($rows, [
                'total_routes' => $rows->count(),
                'total_shipments' => $totalShipments,
                'date_range' => $dateRange,
            ]);
        } catch (Throwable $e) {
            Log::error('Reports route_waiting_times failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    public function mappedBookings(MappedBookingsReportRequest $request)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            $user = $request->user();
            $validated = $request->validated();

            $query = $this->applyBookingScope(
                Booking::query()
                    ->with([
                        'currentDriver.user',
                        'shipment.currentRunShipment.run.driver.user',
                        'shipment.currentRunShipment.run.vehicle.lastDriver.user',
                        'shipment.currentRunShipment.run.latestLocationStop',
                        'shipment.latestVehicleActivity',
                    ]),
                $environment,
                $user
            )
                ->whereIn('status', self::ACTIVE_MAPPED_BOOKING_STATUSES)
                ->whereNotNull('shipment_id');

            if (!empty($validated['merchant_id'])) {
                $merchantId = Merchant::query()
                    ->where('uuid', $validated['merchant_id'])
                    ->value('id');

                if ($merchantId) {
                    $query->where('merchant_id', $merchantId);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }

            if (!empty($validated['search'])) {
                $searchTerm = '%' . str_replace(' ', '%', trim((string) $validated['search'])) . '%';

                $query->where(function (Builder $builder) use ($searchTerm) {
                    $builder
                        ->where('uuid', 'like', $searchTerm)
                        ->orWhereHas('shipment', function (Builder $shipmentQuery) use ($searchTerm) {
                            $shipmentQuery
                                ->where('uuid', 'like', $searchTerm)
                                ->orWhere('merchant_order_ref', 'like', $searchTerm)
                                ->orWhereHas('currentRunShipment.run.vehicle', function (Builder $vehicleQuery) use ($searchTerm) {
                                    $vehicleQuery
                                        ->where('plate_number', 'like', $searchTerm)
                                        ->orWhere('ref_code', 'like', $searchTerm);
                                });
                        })
                        ->orWhereHas('currentDriver.user', function (Builder $driverQuery) use ($searchTerm) {
                            $driverQuery->where('name', 'like', $searchTerm);
                        });
                });
            }

            $bookings = $query
                ->orderByRaw("CASE WHEN status = 'in_transit' THEN 0 ELSE 1 END")
                ->orderByDesc('updated_at')
                ->get()
                ->filter(function (Booking $booking) {
                    $shipment = $booking->shipment;
                    $run = $shipment?->currentRunShipment?->run;
                    $vehicle = $run?->vehicle;
                    $latestActivity = $shipment?->latestVehicleActivity;
                    $latestRunStop = $run?->latestLocationStop;
                    $vehicleLocation = is_array($vehicle?->last_location_address) ? $vehicle->last_location_address : [];

                    $latitude = $latestActivity?->latitude
                        ?? $latestRunStop?->latitude
                        ?? $vehicleLocation['latitude']
                        ?? null;
                    $longitude = $latestActivity?->longitude
                        ?? $latestRunStop?->longitude
                        ?? $vehicleLocation['longitude']
                        ?? null;

                    return is_numeric($latitude) && is_numeric($longitude);
                })
                ->values();

            $countsByStatus = $bookings
                ->groupBy(fn (Booking $booking) => (string) $booking->status)
                ->map(fn ($group) => $group->count())
                ->toArray();

            return ApiResponse::success(
                MappedBookingReportResource::collection($bookings),
                [
                    'counts_by_status' => $countsByStatus,
                    'total' => $bookings->count(),
                ]
            );
        } catch (Throwable $e) {
            Log::error('Reports mapped_bookings failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);

            return $this->apiError($e, 'REPORTS_FAILED', 'Unable to generate report.');
        }
    }

    private function resolveAccessibleMerchants($environment, ?User $user, ?string $merchantUuid = null)
    {
        $merchantScope = $this->applyMerchantScope(Merchant::query(), $environment, $user);

        if (!empty($merchantUuid)) {
            $merchantId = Merchant::query()->where('uuid', $merchantUuid)->value('id');
            if (!$merchantId) {
                return collect();
            }

            $merchantScope->where('id', $merchantId);
        }

        return $merchantScope
            ->select('id', 'uuid', 'name', 'account_id')
            ->get();
    }

    private function buildDocumentExpiryBaseQuery(array $merchantIds, ?string $entityType = null)
    {
        $driverType = addslashes(Driver::class);
        $vehicleType = addslashes(Vehicle::class);
        $shipmentType = addslashes(Shipment::class);

        $query = DB::table('entity_files as ef')
            ->join('file_types as ft', 'ft.id', '=', 'ef.file_type_id')
            ->join('merchants', 'merchants.id', '=', 'ef.merchant_id')
            ->leftJoin('drivers', function ($join) use ($driverType) {
                $join->on('drivers.id', '=', 'ef.attachable_id')
                    ->where('ef.attachable_type', '=', $driverType);
            })
            ->leftJoin('users as driver_users', 'driver_users.id', '=', 'drivers.user_id')
            ->leftJoin('vehicles', function ($join) use ($vehicleType) {
                $join->on('vehicles.id', '=', 'ef.attachable_id')
                    ->where('ef.attachable_type', '=', $vehicleType);
            })
            ->leftJoin('shipments', function ($join) use ($shipmentType) {
                $join->on('shipments.id', '=', 'ef.attachable_id')
                    ->where('ef.attachable_type', '=', $shipmentType);
            })
            ->whereIn('ef.merchant_id', $merchantIds)
            ->whereNull('ef.deleted_at')
            ->whereNull('ft.deleted_at')
            ->where('ft.is_active', true)
            ->whereNotNull('ef.expires_at')
            ->selectRaw("
                merchants.uuid as merchant_id,
                merchants.name as merchant_name,
                ft.entity_type as entity_type,
                ft.uuid as file_type_id,
                ft.name as file_type_name,
                ef.uuid as file_id,
                ef.original_name as original_name,
                ef.created_at as uploaded_at,
                ef.expires_at as expires_at,
                CASE
                    WHEN ef.attachable_type = '{$driverType}' THEN drivers.uuid
                    WHEN ef.attachable_type = '{$vehicleType}' THEN vehicles.uuid
                    WHEN ef.attachable_type = '{$shipmentType}' THEN shipments.uuid
                    ELSE NULL
                END as entity_id,
                CASE
                    WHEN ef.attachable_type = '{$driverType}' THEN COALESCE(driver_users.name, drivers.uuid)
                    WHEN ef.attachable_type = '{$vehicleType}' THEN COALESCE(vehicles.plate_number, vehicles.ref_code, vehicles.uuid)
                    WHEN ef.attachable_type = '{$shipmentType}' THEN COALESCE(shipments.merchant_order_ref, shipments.uuid)
                    ELSE NULL
                END as entity_label
            ");

        if (!empty($entityType)) {
            $query->where('ft.entity_type', $entityType);
        }

        return $query;
    }

    private function entityRequiredCountsByMerchant(array $merchantIds, array $accountIds): array
    {
        $counts = [];
        foreach ($merchantIds as $merchantId) {
            $counts[$merchantId] = [
                FileType::ENTITY_DRIVER => 0,
                FileType::ENTITY_VEHICLE => 0,
                FileType::ENTITY_SHIPMENT => 0,
            ];
        }

        $driverCounts = DB::table('drivers')
            ->whereIn('merchant_id', $merchantIds)
            ->whereNull('deleted_at')
            ->selectRaw('merchant_id, COUNT(*) as total')
            ->groupBy('merchant_id')
            ->pluck('total', 'merchant_id');

        foreach ($driverCounts as $merchantId => $total) {
            $counts[$merchantId][FileType::ENTITY_DRIVER] = (int) $total;
        }

        $merchantAccountMap = Merchant::query()
            ->whereIn('id', $merchantIds)
            ->pluck('account_id', 'id');

        $vehicleCountsByAccount = DB::table('vehicles')
            ->when(!empty($accountIds), fn ($builder) => $builder->whereIn('account_id', $accountIds))
            ->whereNull('deleted_at')
            ->selectRaw('account_id, COUNT(*) as total')
            ->groupBy('account_id')
            ->pluck('total', 'account_id');

        foreach ($merchantAccountMap as $merchantId => $accountId) {
            $counts[$merchantId][FileType::ENTITY_VEHICLE] = (int) ($vehicleCountsByAccount[$accountId] ?? 0);
        }

        $shipmentCounts = DB::table('shipments')
            ->whereIn('merchant_id', $merchantIds)
            ->whereNull('deleted_at')
            ->selectRaw('merchant_id, COUNT(*) as total')
            ->groupBy('merchant_id')
            ->pluck('total', 'merchant_id');

        foreach ($shipmentCounts as $merchantId => $total) {
            $counts[$merchantId][FileType::ENTITY_SHIPMENT] = (int) $total;
        }

        return $counts;
    }

    private function buildMissingDocumentsBaseQuery(array $merchantIds, array $accountIds, array $entityTypes)
    {
        $fileTypes = FileType::query()
            ->whereIn('merchant_id', $merchantIds)
            ->where('is_active', true)
            ->whereIn('entity_type', $entityTypes)
            ->select('id', 'uuid', 'merchant_id', 'entity_type', 'name');

        $driverQuery = DB::table('drivers')
            ->joinSub($fileTypes, 'ft', function ($join) {
                $join->on('ft.merchant_id', '=', 'drivers.merchant_id')
                    ->where('ft.entity_type', '=', FileType::ENTITY_DRIVER);
            })
            ->join('merchants', 'merchants.id', '=', 'ft.merchant_id')
            ->leftJoin('users as driver_users', 'driver_users.id', '=', 'drivers.user_id')
            ->leftJoin('entity_files as ef', function ($join) {
                $join->on('ef.file_type_id', '=', 'ft.id')
                    ->on('ef.attachable_id', '=', 'drivers.id')
                    ->where('ef.attachable_type', '=', Driver::class)
                    ->whereNull('ef.deleted_at');
            })
            ->whereIn('drivers.merchant_id', $merchantIds)
            ->whereNull('drivers.deleted_at')
            ->whereNull('ef.id')
            ->selectRaw('
                merchants.uuid as merchant_id,
                merchants.name as merchant_name,
                ft.entity_type as entity_type,
                ft.uuid as file_type_id,
                ft.name as file_type_name,
                drivers.uuid as entity_id,
                COALESCE(driver_users.name, drivers.uuid) as entity_label
            ');

        $vehicleQuery = DB::table('vehicles')
            ->joinSub($fileTypes, 'ft', function ($join) {
                $join->where('ft.entity_type', '=', FileType::ENTITY_VEHICLE);
            })
            ->join('merchants', 'merchants.id', '=', 'ft.merchant_id')
            ->leftJoin('entity_files as ef', function ($join) {
                $join->on('ef.file_type_id', '=', 'ft.id')
                    ->on('ef.attachable_id', '=', 'vehicles.id')
                    ->where('ef.attachable_type', '=', Vehicle::class)
                    ->whereNull('ef.deleted_at');
            })
            ->whereIn('vehicles.account_id', $accountIds)
            ->whereNull('vehicles.deleted_at')
            ->whereNull('ef.id')
            ->selectRaw('
                merchants.uuid as merchant_id,
                merchants.name as merchant_name,
                ft.entity_type as entity_type,
                ft.uuid as file_type_id,
                ft.name as file_type_name,
                vehicles.uuid as entity_id,
                COALESCE(vehicles.plate_number, vehicles.ref_code, vehicles.uuid) as entity_label
            ');

        $shipmentQuery = DB::table('shipments')
            ->joinSub($fileTypes, 'ft', function ($join) {
                $join->on('ft.merchant_id', '=', 'shipments.merchant_id')
                    ->where('ft.entity_type', '=', FileType::ENTITY_SHIPMENT);
            })
            ->join('merchants', 'merchants.id', '=', 'ft.merchant_id')
            ->leftJoin('entity_files as ef', function ($join) {
                $join->on('ef.file_type_id', '=', 'ft.id')
                    ->on('ef.attachable_id', '=', 'shipments.id')
                    ->where('ef.attachable_type', '=', Shipment::class)
                    ->whereNull('ef.deleted_at');
            })
            ->whereIn('shipments.merchant_id', $merchantIds)
            ->whereNull('shipments.deleted_at')
            ->whereNull('ef.id')
            ->selectRaw('
                merchants.uuid as merchant_id,
                merchants.name as merchant_name,
                ft.entity_type as entity_type,
                ft.uuid as file_type_id,
                ft.name as file_type_name,
                shipments.uuid as entity_id,
                COALESCE(shipments.merchant_order_ref, shipments.uuid) as entity_label
            ');

        $query = null;

        if (in_array(FileType::ENTITY_DRIVER, $entityTypes, true)) {
            $query = $driverQuery;
        }

        if (in_array(FileType::ENTITY_VEHICLE, $entityTypes, true)) {
            $query = $query ? $query->unionAll($vehicleQuery) : $vehicleQuery;
        }

        if (in_array(FileType::ENTITY_SHIPMENT, $entityTypes, true)) {
            $query = $query ? $query->unionAll($shipmentQuery) : $shipmentQuery;
        }

        return $query ?? DB::table('entity_files')->whereRaw('1 = 0');
    }

    private function resolveDateRange(Request $request, $environment, ?User $user): array
    {
        $range = $request->get('date_range', '1month');
        $range = strtolower((string) $range);

        $end = now()->startOfDay();

        return match ($range) {
            'today' => [$end->copy(), $end],
            'yesterday' => [$end->copy()->subDay(), $end->copy()->subDay()],
            'thisweek' => [$end->copy()->startOfWeek(), $end],
            '1week' => [$end->copy()->subDays(6), $end],
            '2weeks' => [$end->copy()->subDays(13), $end],
            '30days' => [$end->copy()->subDays(29), $end],
            '1month' => [$end->copy()->subMonthNoOverflow(), $end],
            '3months' => [$end->copy()->subMonthsNoOverflow(3), $end],
            '6months' => [$end->copy()->subMonthsNoOverflow(6), $end],
            '1year' => [$end->copy()->subYearNoOverflow(), $end],
            'alltime' => $this->resolveAllTimeRange($environment, $user, $end),
            'custom' => $this->resolveCustomDateRange($request),
            default => $this->invalidDateRangeResponse(),
        };
    }

    private function invalidDateRangeResponse(): array
    {
        throw new HttpResponseException(ApiResponse::error(
            'INVALID_DATE_RANGE',
            'Invalid date_range. Use: today, yesterday, thisweek, 1week, 2weeks, 30days, 1month, 3months, 6months, 1year, alltime, custom.',
            [],
            Response::HTTP_UNPROCESSABLE_ENTITY
        ));
    }

    private function resolveCustomDateRange(Request $request): array
    {
        $startDate = $request->get('start_date');
        $endDate = $request->get('end_date');

        if (!$startDate || !$endDate) {
            throw new HttpResponseException(ApiResponse::error(
                'INVALID_DATE_RANGE',
                'Custom date range requires start_date and end_date in YYYY-MM-DD format.',
                [],
                Response::HTTP_UNPROCESSABLE_ENTITY
            ));
        }

        return [
            Carbon::parse((string) $startDate)->startOfDay(),
            Carbon::parse((string) $endDate)->startOfDay(),
        ];
    }

    private function resolveAllTimeRange($environment, ?User $user, Carbon $end): array
    {
        $minQuote = $this->applyQuoteScope(Quote::query(), $environment, $user)->min('created_at');
        $minShipment = $this->applyShipmentScope(Shipment::query(), $environment, $user)->min('created_at');
        $minBooking = $this->applyBookingScope(Booking::query(), $environment, $user)->min('created_at');

        $minDate = collect([$minQuote, $minShipment, $minBooking])
            ->filter()
            ->min();

        if (!$minDate) {
            return [null, null];
        }

        return [Carbon::parse($minDate)->startOfDay(), $end];
    }

    private function buildDateSeries(Carbon $start, Carbon $end): array
    {
        $dates = [];
        $period = CarbonPeriod::create($start->copy()->startOfDay(), $end->copy()->startOfDay());
        foreach ($period as $date) {
            $dates[] = $date->format('Y-m-d');
        }

        return $dates;
    }

    private function countByDate(Builder $query, Carbon $start, Carbon $end): array
    {
        return $query
            ->whereBetween('created_at', [$start->copy()->startOfDay(), $end->copy()->endOfDay()])
            ->selectRaw('DATE(created_at) as date, COUNT(*) as total')
            ->groupBy('date')
            ->orderBy('date')
            ->pluck('total', 'date')
            ->toArray();
    }

    private function applyQuoteScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query
                ->where('merchant_id', $environment->merchant_id)
                ->where('environment_id', $environment->id);
        }

        if ($user && $user->role !== 'super_admin') {
            if (!empty($user->account_id)) {
                $query->where('account_id', $user->account_id);
            } else {
                $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                    $builder->where('users.id', $user->id);
                });
            }
        }

        return $query;
    }

    private function applyShipmentScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query
                ->where('merchant_id', $environment->merchant_id)
                ->where('environment_id', $environment->id);
        }

        if ($user && $user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        }

        return $query;
    }

    private function applyBookingScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query
                ->where('merchant_id', $environment->merchant_id)
                ->where('environment_id', $environment->id);
        }

        if ($user && $user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        }

        return $query;
    }

    private function applyMerchantScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query->where('id', $environment->merchant_id);
        }

        if ($user && $user->role !== 'super_admin') {
            if (!empty($user->account_id)) {
                return $query->where('account_id', $user->account_id);
            }

            $query->whereHas('users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        }

        return $query;
    }

    private function applyVehicleScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query->where('merchant_id', $environment->merchant_id);
        }

        if ($user && $user->role !== 'super_admin') {
            if (!empty($user->account_id)) {
                return $query->where('account_id', $user->account_id);
            }

            $merchantIds = $user->merchants()->pluck('merchants.id');
            if ($merchantIds->isEmpty()) {
                return $query->whereRaw('1 = 0');
            }

            return $query->whereIn('merchant_id', $merchantIds);
        }

        return $query;
    }

    private function applyUserScope(Builder $query, $environment, ?User $user): Builder
    {
        if ($environment) {
            return $query->whereHas('merchants', function (Builder $builder) use ($environment) {
                $builder->where('merchants.id', $environment->merchant_id);
            });
        }

        if ($user && $user->role !== 'super_admin') {
            if (!empty($user->account_id)) {
                return $query->where('account_id', $user->account_id);
            }

            $merchantIds = $user->merchants()->pluck('merchants.id');
            if ($merchantIds->isEmpty()) {
                return $query->whereRaw('1 = 0');
            }

            $query->whereHas('merchants', function (Builder $builder) use ($merchantIds) {
                $builder->whereIn('merchants.id', $merchantIds);
            });
        }

        return $query;
    }

    private function buildShipmentLocationVisitMap(LengthAwarePaginator $shipments, Request $request): array
    {
        return $this->buildShipmentLocationVisitMapForCollection($shipments->getCollection(), $request);
    }

    private function buildShipmentStageActivityMap(LengthAwarePaginator $shipments, Request $request): array
    {
        return $this->buildShipmentStageActivityMapForCollection($shipments->getCollection(), $request);
    }

    private function buildShipmentLocationVisitMapForCollection(Collection $shipments, ?Request $request = null): array
    {
        $shipmentIds = $shipments->pluck('id')->filter()->values();
        if ($shipmentIds->isEmpty()) {
            return [];
        }

        $latestVisitSub = VehicleActivity::query()
            ->selectRaw('shipment_id, location_id, MAX(id) as latest_visit_id')
            ->whereIn('shipment_id', $shipmentIds)
            ->whereNotNull('location_id')
            ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->groupBy('shipment_id', 'location_id')
            ->toBase();

        $visits = VehicleActivity::query()
            ->select('vehicle_activity.*')
            ->joinSub($latestVisitSub, 'latest_location_visit', function ($join) {
                $join->on('latest_location_visit.latest_visit_id', '=', 'vehicle_activity.id');
            })
            ->when($request !== null, function ($query) {
                $query->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment']);
            })
            ->get();

        $map = [];
        foreach ($visits as $visit) {
            $key = $visit->shipment_id . ':' . $visit->location_id;
            $map[$key] = [
                'activity' => $request ? (new VehicleActivityResource($visit))->toArray($request) : null,
                'time_in' => $visit->entered_at ? Carbon::parse($visit->entered_at)->toIso8601String() : null,
                'time_out' => $visit->exited_at ? Carbon::parse($visit->exited_at)->toIso8601String() : null,
            ];
        }

        return $map;
    }

    private function buildShipmentStageActivityMapForCollection(Collection $shipments, ?Request $request = null): array
    {
        $shipmentIds = $shipments->pluck('id')->filter()->values();
        if ($shipmentIds->isEmpty()) {
            return [];
        }

        $latestStageSub = VehicleActivity::query()
            ->selectRaw('shipment_id, event_type, MAX(id) as latest_activity_id')
            ->whereIn('shipment_id', $shipmentIds)
            ->whereIn('event_type', [
                VehicleActivity::EVENT_SHIPMENT_COLLECTION,
                VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            ])
            ->groupBy('shipment_id', 'event_type')
            ->toBase();

        $activities = VehicleActivity::query()
            ->select('vehicle_activity.*')
            ->joinSub($latestStageSub, 'latest_shipment_stage_activity', function ($join) {
                $join->on('latest_shipment_stage_activity.latest_activity_id', '=', 'vehicle_activity.id');
            })
            ->when($request !== null, function ($query) {
                $query->with(['merchant', 'vehicle.lastDriver.user', 'location', 'run.driver.user', 'shipment']);
            })
            ->get();

        $map = [];
        foreach ($activities as $activity) {
            $key = $activity->shipment_id . ':' . $activity->event_type;
            $map[$key] = [
                'activity' => $request ? (new VehicleActivityResource($activity))->toArray($request) : null,
                'time_in' => $activity->entered_at ? Carbon::parse($activity->entered_at)->toIso8601String() : null,
                'time_out' => $activity->exited_at ? Carbon::parse($activity->exited_at)->toIso8601String() : null,
            ];
        }

        return $map;
    }

    private function diffInMinutesOrNull(?string $start, ?string $end): ?float
    {
        if (!$start || !$end) {
            return null;
        }

        $startAt = Carbon::parse($start);
        $endAt = Carbon::parse($end);
        if ($endAt->lessThan($startAt)) {
            return null;
        }

        return $startAt->diffInSeconds($endAt) / 60;
    }

    private function averageMinutes(float $total, int $count): ?float
    {
        if ($count <= 0) {
            return null;
        }

        return $total / $count;
    }

    private function formatRouteLocationLabel($location): string
    {
        if (!$location) {
            return 'Unknown';
        }

        return $location->name ?: ($location->code ?: ($location->uuid ?: 'Unknown'));
    }

    private function formatDeliveredVolume(Shipment $shipment): ?string
    {
        $groups = $shipment->parcels
            ->groupBy(function ($parcel) {
                $measurement = strtolower(trim((string) $parcel->weight_measurement));

                return $measurement !== '' ? $measurement : 'unit';
            })
            ->map(function ($parcels, string $measurement) {
                $total = (float) $parcels->sum(function ($parcel) {
                    return (float) $parcel->weight;
                });

                if ($total <= 0) {
                    return null;
                }

                $formatted = number_format($total, 3, '.', '');
                $formatted = rtrim(rtrim($formatted, '0'), '.');

                return $formatted . ' ' . $measurement;
            })
            ->filter()
            ->values();

        return $groups->isEmpty() ? null : $groups->implode(', ');
    }
}
