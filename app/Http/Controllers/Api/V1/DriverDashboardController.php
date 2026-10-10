<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DriverShipmentResource;
use App\Models\FileType;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class DriverDashboardController extends Controller
{
    public function __invoke(Request $request)
    {
        $driver = $request->user()->driver;
        if (!$driver || !$driver->is_active || $driver->account_id !== $request->user()->account_id) {
            return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], 403);
        }

        $timezone = $driver->merchant?->timezone ?: config('app.timezone');
        $today = now($timezone);
        $start = $today->copy()->startOfDay()->utc();
        $end = $today->copy()->endOfDay()->utc();

        // Include overdue assigned work, but do not count tomorrow's pickups.
        $active = Shipment::query()
            ->where('account_id', $driver->account_id)
            ->whereNotIn('status', ['delivered', 'failed', 'cancelled'])
            ->whereHas('currentRunShipment.run', fn ($query) => $query->where('driver_id', $driver->id))
            ->whereRaw('COALESCE(collection_date, ready_at, created_at) <= ?', [$end]);

        // A completed run must still contribute to today's delivered count.
        $delivered = Shipment::query()
            ->where('account_id', $driver->account_id)
            ->where('status', 'delivered')
            ->whereHas('booking', fn ($query) => $query
                ->where('current_driver_id', $driver->id)
                ->whereBetween('delivered_at', [$start, $end]))
            ->count();

        $remaining = (clone $active)->count();
        $next = $active->with([
            'pickupLocation', 'dropoffLocation', 'merchant', 'environment',
            'currentRunShipment.run.driver.user', 'currentRunShipment.run.vehicle',
            'parcels', 'booking.pod.capturedBy', 'booking.currentDriver',
        ])
            ->orderByRaw('COALESCE(collection_date, ready_at, created_at)')
            ->orderBy(RunShipment::select('sequence')
                ->whereColumn('shipment_id', 'shipments.id')
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->whereHas('run', fn ($query) => $query->where('driver_id', $driver->id)
                    ->whereIn('status', ['draft', 'dispatched', 'in_progress']))
                ->latest('id')->limit(1))
            ->orderBy('shipments.id')->first();

        // Prefer the run already on the road; otherwise show the next assigned run.
        $currentRun = $driver->runs()
            ->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->whereIn('status', [Run::STATUS_IN_PROGRESS, Run::STATUS_DISPATCHED, Run::STATUS_DRAFT])
            ->when($request->query('run_id'), fn ($q) => $q->orderByRaw('CASE WHEN uuid = ? THEN 0 ELSE 1 END', [$request->query('run_id')]))
            ->orderByRaw("CASE status WHEN 'in_progress' THEN 0 WHEN 'dispatched' THEN 1 ELSE 2 END")
            ->orderBy('started_at')->orderBy('id')->first();
        $runData = app(\App\Services\DriverRunDataService::class);
        $runShipments = $runData->shipments($currentRun, $driver);
        $timeline = $runData->timeline($currentRun, $driver, $runShipments);

        // Stored run uploads, not shipment counts, determine whether another note is needed.
        $hasDeliveryNote = $currentRun ? $currentRun->deliveryNoteImports()
            ->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->where('environment_id', $currentRun->environment_id)
            ->exists() : false;

        // Match document coverage: each active driver file type requires an upload.
        $files = $driver->files()
            ->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id);
        $uploadedTypes = (clone $files)->distinct()->pluck('file_type_id');
        $missingTypes = FileType::query()
            ->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->where('entity_type', FileType::ENTITY_DRIVER)
            ->where('is_active', true)
            ->whereNotIn('id', $uploadedTypes)
            ->orderBy('sort_order')->orderBy('name')
            ->get(['name', 'driver_can_upload']);
        $expiredCount = (clone $files)->whereNotNull('expires_at')->where('expires_at', '<', now())->count();

        // On the road means an in-progress run, not merely a planned assignment.
        // Completed/failed attachments still count; removed or deleted shipments do not.
        $emptyRun = $driver->runs()
            ->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->where('status', Run::STATUS_IN_PROGRESS)
            ->whereDoesntHave('runShipments', fn ($query) => $query
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->whereHas('shipment'))
            ->orderBy('started_at')->orderBy('id')->first();

        return ApiResponse::success([
            'delivery_note_required_run_id' => $emptyRun?->uuid,
            'date' => $today->toDateString(),
            'timezone' => $timezone,
            'delivered' => $delivered,
            'remaining' => $remaining,
            'total' => $delivered + $remaining,
            'trip_endpoints' => $currentRun ? collect([['role' => 'Run starting point', 'location' => $currentRun->originLocation], ['role' => 'Planned end location', 'location' => $currentRun->destinationLocation]])->filter(fn ($item) => $item['location'])->map(fn ($item) => ['role' => $item['role'], 'name' => $item['location']->name, 'address' => $item['location']->full_address, 'latitude' => $item['location']->latitude !== null ? (float) $item['location']->latitude : null, 'longitude' => $item['location']->longitude !== null ? (float) $item['location']->longitude : null])->values() : [],
            'current_run' => $currentRun ? ['run_id' => $currentRun->uuid, 'status' => $currentRun->status, 'started_at' => $currentRun->started_at?->toIso8601String(), 'has_delivery_note' => $hasDeliveryNote, 'destination_location_id' => $currentRun->destinationLocation?->uuid, 'origin_location_id' => $currentRun->originLocation?->uuid, 'end_request' => $currentRun->latestEndRequest?->toSummary()] : null,
            'recorded_stops' => $timeline['recorded_stops'],
            'planned_delivery_stops' => $timeline['planned_delivery_stops'],
            'run_shipments' => DriverShipmentResource::collection($runShipments),
            'next_shipment' => $next ? new DriverShipmentResource($next) : null,
            'dispatch_email' => $driver->merchant?->support_email,
            'documents' => [
                'missing_required_count' => $missingTypes->count(),
                'missing_required_names' => $missingTypes->pluck('name')->all(),
                'missing_managed_by_dispatch_count' => $missingTypes->where('driver_can_upload', false)->count(),
                'expired_count' => $expiredCount,
            ],
        ]);
    }
}
