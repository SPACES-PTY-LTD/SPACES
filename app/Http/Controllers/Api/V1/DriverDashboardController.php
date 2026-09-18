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
        $runShipments = $currentRun ? $currentRun->runShipments()
            ->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', fn ($query) => $query
                ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id))
            ->with([
                'shipment.pickupLocation', 'shipment.dropoffLocation', 'shipment.merchant', 'shipment.environment',
                'shipment.currentRunShipment.run.driver.user', 'shipment.currentRunShipment.run.vehicle',
                'shipment.parcels', 'shipment.booking.pod.capturedBy', 'shipment.booking.currentDriver',
            ])
            ->orderBy('sequence')->orderBy('id')->get()->pluck('shipment')->unique('id')->values()
            : collect();

        $activities = $currentRun ? $currentRun->vehicleActivities()
            ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->whereIn('event_type', ['stopped', 'entered_location', 'shipment_collection', 'shipment_delivery', 'speeding'])
            ->with(['location' => fn ($query) => $query->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)])
            ->get() : collect();
        $recordedStops = $activities->groupBy(function ($stop) {
            if ($stop->event_type === 'speeding') return $stop->uuid;
            // Stage events from the same recorded visit share a location and arrival time.
            $arrival = $stop->entered_at ?? $stop->occurred_at;
            return $stop->location_id && $arrival ? $stop->location_id.':'.$arrival->toIso8601String() : $stop->uuid;
        })->map(function ($events) use ($runShipments) {
            $stop = $events->first();
            if ($stop->event_type === 'speeding') {
                return [
                    'stop_id' => $stop->uuid, 'kind' => 'Speeding',
                    'name' => $stop->location?->name ?: 'Speeding event',
                    'address' => $stop->location?->full_address,
                    'occurred_at' => $stop->occurred_at?->toIso8601String(), 'exited_at' => null,
                    'speed_kph' => $stop->speed_kph !== null ? (float) $stop->speed_kph : null,
                    'speed_limit_kph' => $stop->speed_limit_kph !== null ? (float) $stop->speed_limit_kph : null,
                    'shipments' => collect(),
                ];
            }
            $types = $events->pluck('event_type');
            $isCollection = $types->contains('shipment_collection');
            $isDelivery = $types->contains('shipment_delivery');
            $linked = $runShipments->filter(fn ($shipment) => $events->pluck('shipment_id')->contains($shipment->id)
                || $events->pluck('uuid')->contains($shipment->metadata['matched_stop_id'] ?? null)
                || ($stop->location_id && in_array($stop->location_id, [$shipment->pickup_location_id, $shipment->dropoff_location_id])));
            if ($linked->contains(fn ($s) => $events->pluck('uuid')->contains($s->metadata['matched_stop_id'] ?? null))) $isDelivery = true;
            if (!$isCollection && !$isDelivery && $stop->location_id) {
                $isCollection = $linked->contains('pickup_location_id', $stop->location_id);
                $isDelivery = $linked->contains('dropoff_location_id', $stop->location_id);
            }
            $kind = $isCollection && $isDelivery ? 'Collection / delivery' : ($isCollection ? 'Collection' : ($isDelivery ? 'Delivery' : 'Stop'));
            $shipment = $linked->first();
            $location = $stop->location ?? ($isCollection ? $shipment?->pickupLocation : ($isDelivery ? $shipment?->dropoffLocation : null));
            return [
                'stop_id' => $stop->uuid,
                'kind' => $kind,
                'name' => $location?->name ?: 'Truck stop',
                'address' => $location?->full_address,
                'occurred_at' => ($stop->entered_at ?? $stop->occurred_at)?->toIso8601String(),
                'exited_at' => $events->pluck('exited_at')->filter()->max()?->toIso8601String(),
                'shipments' => $linked->map(fn ($s) => ['shipment_id' => $s->uuid, 'reference' => $s->merchant_order_ref])->values(),
            ];
        })->sortBy('occurred_at')->values();

        $visitedDeliveryIds = $recordedStops->filter(fn ($stop) => str_contains(strtolower($stop['kind']), 'delivery'))
            ->flatMap(fn ($stop) => $stop['shipments']->pluck('shipment_id'));
        $plannedDeliveryStops = $runShipments->filter(fn ($shipment) => !in_array($shipment->status, ['delivered', 'failed', 'cancelled', 'returned'])
)
            ->groupBy(fn ($shipment) => $shipment->dropoff_location_id ?: 'shipment:'.$shipment->id)
            ->map(function ($shipments) {
                $first = $shipments->first();
                return [
                    'stop_id' => 'planned:'.($first->dropoffLocation?->uuid ?? $first->uuid),
                    'kind' => 'Delivery', 'planned' => true,
                    'name' => $first->dropoffLocation?->name ?: 'Delivery location not provided',
                    'address' => $first->dropoffLocation?->full_address,
                    'occurred_at' => null, 'exited_at' => null,
                    'shipments' => $shipments->map(fn ($s) => ['shipment_id' => $s->uuid, 'reference' => $s->merchant_order_ref])->values(),
                ];
            })->values();

        if ($currentRun?->destinationLocation) {
            $end = $currentRun->destinationLocation;
            $plannedDeliveryStops->push(['stop_id' => 'planned-end:'.$end->uuid, 'kind' => 'Planned end', 'planned' => true,
                'name' => $end->name, 'address' => $end->full_address, 'occurred_at' => null, 'exited_at' => null, 'shipments' => collect()]);
        }

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
            'current_run' => $currentRun ? ['run_id' => $currentRun->uuid, 'status' => $currentRun->status, 'destination_location_id' => $currentRun->destinationLocation?->uuid] : null,
            'recorded_stops' => $recordedStops,
            'planned_delivery_stops' => $plannedDeliveryStops,
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
