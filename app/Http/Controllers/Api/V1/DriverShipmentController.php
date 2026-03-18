<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DriverCancelRequest;
use App\Http\Requests\DriverPodRequest;
use App\Http\Requests\DriverScanRequest;
use App\Http\Requests\DriverStatusUpdateRequest;
use App\Http\Resources\DriverShipmentResource;
use App\Models\Booking;
use App\Models\BookingPod;
use App\Models\CancelReason;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\ShipmentParcel;
use App\Models\TrackingEvent;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DriverShipmentController extends Controller
{
    private const STATUS_FLOW = [
        'booked',
        'pickup_scheduled',
        'picked_up',
        'in_transit',
        'out_for_delivery',
        'delivered',
        'failed',
    ];

    public function index(Request $request)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $perPage = min((int) $request->get('per_page', 15), 100);

            $shipments = $this->queryDriverShipments($driver)
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($shipments, DriverShipmentResource::collection($shipments));
        } catch (Throwable $e) {
            Log::error('Driver shipments list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENTS_FAILED', 'Unable to list shipments.');
        }
    }

    public function show(Request $request, string $shipment_uuid)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $shipment = $this->queryDriverShipments($driver)
                ->where('uuid', $shipment_uuid)
                ->firstOrFail();

            return ApiResponse::success(new DriverShipmentResource($shipment));
        } catch (Throwable $e) {
            Log::error('Driver shipment fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENT_NOT_FOUND', 'Shipment not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function updateStatus(DriverStatusUpdateRequest $request, string $shipment_uuid, ActivityLogService $activityLogService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $shipment = $this->findDriverShipment($driver, $shipment_uuid);
            $booking = $this->requireShipmentBooking($shipment);

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                return ApiResponse::error('INVALID_CARRIER', 'Driver actions are only allowed for internal carriers.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $newStatus = $request->validated()['status'];
            $before = $booking->only(['status', 'collected_at', 'delivered_at', 'returned_at']);
            $currentIndex = array_search($booking->status, self::STATUS_FLOW, true);
            $newIndex = array_search($newStatus, self::STATUS_FLOW, true);

            if ($currentIndex === false || $newIndex === false || $newIndex < $currentIndex) {
                return ApiResponse::error('INVALID_STATUS', 'Invalid status transition.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $updateData = ['status' => $newStatus];

            if ($newStatus === 'picked_up' && !$booking->collected_at) {
                $updateData['collected_at'] = now();
            }

            if ($newStatus === 'delivered' && !$booking->delivered_at) {
                $updateData['delivered_at'] = now();
            }

            if ($newStatus === 'returned' && !$booking->returned_at) {
                $updateData['returned_at'] = now();
            }

            $booking->update($updateData);
            $changes = $activityLogService->diffChanges($before, $booking->only(array_keys($before)));
            if (!empty($changes)) {
                $activityLogService->log(
                    action: 'updated',
                    entityType: 'booking',
                    entity: $booking,
                    actor: $request->user(),
                    accountId: $booking->account_id,
                    merchantId: $booking->merchant_id,
                    environmentId: $booking->environment_id,
                    title: 'Booking status updated by driver',
                    changes: $changes
                );
            }

            if (in_array($newStatus, ['delivered', 'failed'], true)) {
                $shipment->update(['status' => $newStatus]);
            }

            TrackingEvent::create([
                'account_id' => $booking->account_id,
                'merchant_id' => $booking->merchant_id,
                'shipment_id' => $shipment->id,
                'booking_id' => $booking->id,
                'event_code' => $newStatus,
                'event_description' => $request->validated()['note'] ?? 'Status updated by driver.',
                'occurred_at' => now(),
                'payload' => ['source' => 'driver'],
            ]);

            return ApiResponse::success(new DriverShipmentResource($this->refreshDriverShipment($shipment)));
        } catch (Throwable $e) {
            Log::error('Driver shipment status update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENT_STATUS_UPDATE_FAILED', 'Unable to update shipment status.');
        }
    }

    public function scan(DriverScanRequest $request, string $shipment_uuid)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $shipment = $this->findDriverShipment($driver, $shipment_uuid);
            $booking = $this->requireShipmentBooking($shipment);

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                return ApiResponse::error('INVALID_CARRIER', 'Driver actions are only allowed for internal carriers.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $payload = $request->validated();
            $shipment->loadMissing('parcels.pickedUpScannedBy');
            if ($shipment->parcels->isEmpty()) {
                return ApiResponse::error('NO_PARCELS', 'Shipment has no parcels available for pickup scanning.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            /** @var ShipmentParcel|null $parcel */
            $parcel = $shipment->parcels->firstWhere('parcel_code', $payload['parcel_code']);
            if (!$parcel) {
                return ApiResponse::error('INVALID_PARCEL', 'Scanned parcel code does not belong to this shipment.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            if ($parcel->picked_up_scanned_at) {
                return ApiResponse::success(
                    new DriverShipmentResource($this->refreshDriverShipment($shipment)),
                    [
                        'scan_status' => 'already_scanned',
                        'message' => 'Parcel already scanned.',
                        'scanned_parcel_code' => $parcel->parcel_code,
                    ]
                );
            }

            $occurredAt = !empty($payload['occurred_at'])
                ? Carbon::parse($payload['occurred_at'])
                : now();

            $parcel->update([
                'picked_up_scanned_at' => $occurredAt,
                'picked_up_scanned_by_user_id' => $request->user()?->id,
            ]);

            TrackingEvent::create([
                'account_id' => $booking->account_id,
                'merchant_id' => $booking->merchant_id,
                'shipment_id' => $shipment->id,
                'booking_id' => $booking->id,
                'event_code' => 'parcel_scanned',
                'event_description' => $payload['event_description'] ?? 'Parcel scanned at pickup.',
                'occurred_at' => $occurredAt,
                'payload' => array_merge($payload['payload'] ?? [], [
                    'source' => 'driver',
                    'parcel_id' => $parcel->uuid,
                    'parcel_code' => $parcel->parcel_code,
                ]),
            ]);

            $shipment = $this->refreshDriverShipment($shipment);
            $scannedParcelCount = $shipment->parcels->filter(fn ($shipmentParcel) => $shipmentParcel->picked_up_scanned_at !== null)->count();
            $totalParcelCount = $shipment->parcels->count();
            $allParcelsScanned = $totalParcelCount > 0 && $scannedParcelCount === $totalParcelCount;

            if ($allParcelsScanned) {
                $booking->update([
                    'status' => 'picked_up',
                    'collected_at' => $booking->collected_at ?? $occurredAt,
                ]);

                TrackingEvent::create([
                    'account_id' => $booking->account_id,
                    'merchant_id' => $booking->merchant_id,
                    'shipment_id' => $shipment->id,
                    'booking_id' => $booking->id,
                    'event_code' => 'picked_up',
                    'event_description' => 'All shipment parcels scanned at pickup.',
                    'occurred_at' => $occurredAt,
                    'payload' => [
                        'source' => 'driver',
                        'scanned_parcel_count' => $scannedParcelCount,
                        'total_parcel_count' => $totalParcelCount,
                    ],
                ]);

                $booking->update([
                    'status' => 'in_transit',
                    'collected_at' => $booking->collected_at ?? $occurredAt,
                ]);
                $shipment->update([
                    'status' => 'in_transit',
                ]);

                TrackingEvent::create([
                    'account_id' => $booking->account_id,
                    'merchant_id' => $booking->merchant_id,
                    'shipment_id' => $shipment->id,
                    'booking_id' => $booking->id,
                    'event_code' => 'in_transit',
                    'event_description' => 'Shipment moved to in transit after all parcels were scanned.',
                    'occurred_at' => $occurredAt,
                    'payload' => [
                        'source' => 'driver',
                        'scanned_parcel_count' => $scannedParcelCount,
                        'total_parcel_count' => $totalParcelCount,
                    ],
                ]);
            }

            return ApiResponse::success(
                new DriverShipmentResource($this->refreshDriverShipment($shipment)),
                [
                    'scan_status' => $allParcelsScanned ? 'completed' : 'scanned',
                    'message' => $allParcelsScanned
                        ? 'All parcels scanned. Shipment is now in transit.'
                        : 'Parcel scan recorded.',
                    'scanned_parcel_code' => $parcel->parcel_code,
                    'scanned_parcel_count' => $scannedParcelCount,
                    'total_parcel_count' => $totalParcelCount,
                    'all_parcels_scanned' => $allParcelsScanned,
                ]
            );
        } catch (Throwable $e) {
            Log::error('Driver shipment scan failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENT_SCAN_FAILED', 'Unable to record shipment scan.');
        }
    }

    public function pod(DriverPodRequest $request, string $shipment_uuid)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $shipment = $this->findDriverShipment($driver, $shipment_uuid);
            $booking = $this->requireShipmentBooking($shipment);

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                return ApiResponse::error('INVALID_CARRIER', 'Driver actions are only allowed for internal carriers.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $data = $request->validated();

            BookingPod::updateOrCreate(
                ['booking_id' => $booking->id],
                [
                    'account_id' => $booking->account_id,
                    'file_key' => $data['file_key'],
                    'file_type' => $data['file_type'] ?? null,
                    'signed_by' => $data['signed_by'] ?? null,
                    'captured_by_user_id' => $request->user()?->id,
                    'metadata' => $data['metadata'] ?? null,
                ]
            );

            return ApiResponse::success(new DriverShipmentResource($this->refreshDriverShipment($shipment)));
        } catch (Throwable $e) {
            Log::error('Driver shipment POD failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENT_POD_FAILED', 'Unable to save shipment POD.');
        }
    }

    public function cancel(DriverCancelRequest $request, string $shipment_uuid, ActivityLogService $activityLogService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $shipment = $this->findDriverShipment($driver, $shipment_uuid);
            $booking = $this->requireShipmentBooking($shipment);

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                return ApiResponse::error('INVALID_CARRIER', 'Driver actions are only allowed for internal carriers.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $data = $request->validated();
            $reason = CancelReason::where('code', $data['reason_code'])->firstOrFail();

            if ($reason->code === 'other' && empty($data['reason'])) {
                return ApiResponse::error('REASON_REQUIRED', 'Reason is required when using other.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $before = $booking->only([
                'status',
                'cancelled_at',
                'cancellation_reason_code',
                'cancellation_reason_note',
                'cancel_reason',
            ]);
            $booking->update([
                'status' => 'cancelled',
                'cancelled_at' => now(),
                'cancellation_reason_code' => $data['reason_code'],
                'cancellation_reason_note' => $data['note'] ?? null,
                'cancel_reason' => $data['reason'] ?? null,
            ]);
            $changes = $activityLogService->diffChanges($before, $booking->only(array_keys($before)));
            if (!empty($changes)) {
                $activityLogService->log(
                    action: 'updated',
                    entityType: 'booking',
                    entity: $booking,
                    actor: $request->user(),
                    accountId: $booking->account_id,
                    merchantId: $booking->merchant_id,
                    environmentId: $booking->environment_id,
                    title: 'Booking cancelled by driver',
                    changes: $changes
                );
            }

            $shipment->update(['status' => 'cancelled']);

            return ApiResponse::success(new DriverShipmentResource($this->refreshDriverShipment($shipment)));
        } catch (Throwable $e) {
            Log::error('Driver shipment cancel failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_SHIPMENT_CANCEL_FAILED', 'Unable to cancel shipment.');
        }
    }

    private function queryDriverShipments(Driver $driver): Builder
    {
        return Shipment::with([
            'pickupLocation',
            'dropoffLocation',
            'currentRunShipment.run.driver.user',
            'currentRunShipment.run.vehicle.lastDriver.user',
            'parcels',
            'vehicleActivities',
            'booking.pod.capturedBy',
            'booking.currentDriver',
            'parcels.pickedUpScannedBy',
            'merchant',
            'environment',
        ])->whereHas('currentRunShipment.run', function (Builder $builder) use ($driver) {
            $builder->where('driver_id', $driver->id)
                ->whereIn('status', [
                    Run::STATUS_DRAFT,
                    Run::STATUS_DISPATCHED,
                    Run::STATUS_IN_PROGRESS,
                ]);
        });
    }

    private function findDriverShipment(Driver $driver, string $shipmentUuid): Shipment
    {
        return $this->queryDriverShipments($driver)
            ->where('uuid', $shipmentUuid)
            ->firstOrFail();
    }

    private function requireShipmentBooking(Shipment $shipment): Booking
    {
        $booking = $shipment->booking;

        if (!$booking) {
            throw (new ModelNotFoundException())->setModel(Booking::class);
        }

        return $booking;
    }

    private function refreshDriverShipment(Shipment $shipment): Shipment
    {
        return $shipment->fresh([
            'pickupLocation',
            'dropoffLocation',
            'currentRunShipment.run.driver.user',
            'currentRunShipment.run.vehicle.lastDriver.user',
            'parcels',
            'vehicleActivities',
            'booking.pod.capturedBy',
            'booking.currentDriver',
            'parcels.pickedUpScannedBy',
            'merchant',
            'environment',
        ]);
    }
}
