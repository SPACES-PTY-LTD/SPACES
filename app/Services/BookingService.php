<?php

namespace App\Services;

use App\Jobs\BookShipmentJob;
use App\Jobs\CancelBookingJob;
use App\Models\Booking;
use App\Models\Carrier;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\QuoteOption;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BookingService
{
    public function __construct(
        private ShipmentService $shipmentService,
        private QuoteService $quoteService,
        private ActivityLogService $activityLogService
    ) {
    }

    public function listBookings(User $user, array $filters): LengthAwarePaginator
    {
        $query = Booking::query()->with([
            'shipment.pickupLocation',
            'shipment.dropoffLocation',
            'quoteOption',
            'merchant',
            'environment',
            'currentDriver.user',
            'pod',
        ]);

        if ($user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        } elseif (!empty($filters['with_trashed'])) {
            $query->withTrashed();
        }

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if (!empty($merchantUuid)) {
            $merchant = Merchant::where('uuid', $merchantUuid)->first();
            if ($merchant) {
                $query->where('merchant_id', $merchant->id);
            }
        }

        $environmentUuid = $filters['environment_uuid'] ?? $filters['environment_id'] ?? null;
        if (!empty($environmentUuid)) {
            $environmentId = MerchantEnvironment::where('uuid', $environmentUuid)->value('id');
            if ($environmentId) {
                $query->where('environment_id', $environmentId);
            }
        }

        $shipmentUuid = $filters['shipment_uuid'] ?? $filters['shipment_id'] ?? null;
        if (!empty($shipmentUuid)) {
            $shipmentId = Shipment::where('uuid', $shipmentUuid)->value('id');
            if ($shipmentId) {
                $query->where('shipment_id', $shipmentId);
            }
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['carrier_code'])) {
            $query->where('carrier_code', $filters['carrier_code']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $this->applyListSorting($query, $filters)->paginate($perPage);
    }

    public function listBookingsForEnvironment(MerchantEnvironment $environment, array $filters): LengthAwarePaginator
    {
        $query = Booking::query()
            ->with([
                'shipment.pickupLocation',
                'shipment.dropoffLocation',
                'quoteOption',
                'merchant',
                'environment',
                'currentDriver.user',
                'pod',
            ])
            ->where('merchant_id', $environment->merchant_id)
            ->where('environment_id', $environment->id);

        $shipmentUuid = $filters['shipment_uuid'] ?? $filters['shipment_id'] ?? null;
        if (!empty($shipmentUuid)) {
            $shipmentId = Shipment::where('uuid', $shipmentUuid)->value('id');
            if ($shipmentId) {
                $query->where('shipment_id', $shipmentId);
            }
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['carrier_code'])) {
            $query->where('carrier_code', $filters['carrier_code']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $this->applyListSorting($query, $filters)->paginate($perPage);
    }

    private function applyListSorting(Builder $query, array $filters): Builder
    {
        $sortableColumns = [
            'created_at' => 'created_at',
            'uuid' => 'uuid',
            'shipment_id' => 'shipment_id',
            'status' => 'status',
            'booked_at' => 'booked_at',
        ];
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';

        return $query
            ->orderBy($sortColumn, $sortDirection)
            ->orderBy('id');
    }

    public function bookShipment(Shipment $shipment, QuoteOption $option, bool $sync = false): Booking
    {
        $booking = DB::transaction(function () use ($shipment, $option, $sync) {
            $accountId = $shipment->account_id;
            $quote = $option->quote;

            $shipment->update(['status' => 'booked']);
            if ($quote) {
                $quote->update(['status' => 'booked']);
            }

            $booking = Booking::create([
                'account_id' => $accountId,
                'merchant_id' => $shipment->merchant_id,
                'environment_id' => $shipment->environment_id,
                'shipment_id' => $shipment->id,
                'quote_option_id' => $option->id,
                'status' => 'booked',
                'carrier_code' => $option->carrier_code,
                'booked_at' => now(),
                'collected_at' => null,
                'delivered_at' => null,
                'returned_at' => null,
                'odometer_at_request' => null,
                'odometer_at_collection' => null,
                'odometer_at_delivery' => null,
                'odometer_at_return' => null,
                'total_km_from_collection' => null,
            ]);

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                if ($sync) {
                    BookShipmentJob::dispatchSync($booking->id);
                } else {
                    BookShipmentJob::dispatch($booking->id);
                }
            }

            return $booking;
        });

        $this->activityLogService->log(
            action: 'created',
            entityType: 'booking',
            entity: $booking,
            accountId: $booking->account_id,
            merchantId: $booking->merchant_id,
            environmentId: $booking->environment_id,
            title: 'Booking created',
            changes: $this->activityLogService->diffChanges([], [
                'status' => $booking->status,
                'carrier_code' => $booking->carrier_code,
                'booked_at' => $booking->booked_at,
            ])
        );

        return $booking;
    }

    public function rebookShipment(Shipment $shipment, QuoteOption $option, bool $sync = false): Booking
    {
        $booking = DB::transaction(function () use ($shipment, $option, $sync) {
            $existingBooking = $shipment->booking()->first();
            if (!$existingBooking) {
                return $this->bookShipment($shipment, $option, $sync);
            }

            $before = $existingBooking->only([
                'quote_option_id',
                'status',
                'carrier_code',
                'booked_at',
                'cancelled_at',
                'cancellation_reason_code',
                'cancellation_reason_note',
                'cancel_reason',
            ]);

            if (!in_array($existingBooking->status, ['cancelled', 'failed'], true)) {
                throw ValidationException::withMessages([
                    'shipment_id' => ['Shipment can only be rebooked when current booking is cancelled or failed.'],
                ]);
            }

            $quote = $option->quote;
            $shipment->update(['status' => 'booked']);
            if ($quote) {
                $quote->update(['status' => 'booked']);
            }

            $existingBooking->update([
                'quote_option_id' => $option->id,
                'status' => 'booked',
                'carrier_code' => $option->carrier_code,
                'carrier_job_id' => null,
                'label_url' => null,
                'booked_at' => now(),
                'collected_at' => null,
                'delivered_at' => null,
                'returned_at' => null,
                'cancelled_at' => null,
                'odometer_at_request' => null,
                'odometer_at_collection' => null,
                'odometer_at_delivery' => null,
                'odometer_at_return' => null,
                'total_km_from_collection' => null,
                'cancellation_reason_code' => null,
                'cancellation_reason_note' => null,
                'cancel_reason' => null,
            ]);

            $carrier = Carrier::where('code', $existingBooking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                if ($sync) {
                    BookShipmentJob::dispatchSync($existingBooking->id);
                } else {
                    BookShipmentJob::dispatch($existingBooking->id);
                }
            }

            $existingBooking->setAttribute('_activity_before', $before);

            return $existingBooking;
        });

        $before = $booking->getAttribute('_activity_before') ?? [];
        $after = $booking->only(array_keys($before));
        $changes = $this->activityLogService->diffChanges($before, $after);
        if (!empty($changes)) {
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'booking',
                entity: $booking,
                accountId: $booking->account_id,
                merchantId: $booking->merchant_id,
                environmentId: $booking->environment_id,
                title: 'Booking rebooked',
                changes: $changes
            );
        }

        return $booking;
    }

    public function requestOnDemand(array $data, bool $sync = false): array
    {
        $result = $this->shipmentService->createShipment($data);
        $shipment = $result['shipment'];
        $created = (bool) ($result['created'] ?? false);
        $message = $result['message'] ?? null;

        $shipment->loadMissing('booking');
        $autoAssign = array_key_exists('auto_assign', $data)
            ? (bool) $data['auto_assign']
            : (bool) $shipment->auto_assign;

        if (!$autoAssign) {
            return [
                'shipment' => $shipment,
                'booking' => $shipment->booking,
                'created' => $created,
                'message' => $message ?? 'Shipment ready for manual booking.',
                'status' => 'manual_booking_required',
            ];
        }

        if ($shipment->booking) {
            return [
                'shipment' => $shipment,
                'booking' => $shipment->booking,
                'created' => false,
                'message' => 'Shipment already has a booking. Returning existing booking.',
                'status' => 'already_booked',
            ];
        }

        $quote = $this->quoteService->createQuote([
            'merchant_id' => $data['merchant_id'],
            'environment_id' => $data['environment_id'] ?? null,
            'shipment_id' => $shipment->uuid,
            'collection_date' => optional($shipment->collection_date)->toIso8601String(),
            'metadata' => $data['metadata'] ?? $shipment->metadata,
        ], true);

        $quote->load('options');
        $option = $quote->options->sortBy('total_amount')->first();

        if (!$option) {
            return [
                'shipment' => $shipment,
                'booking' => null,
                'created' => $created,
                'message' => 'No quote options available. Shipment created and awaiting manual action.',
                'status' => 'awaiting_quote_options',
            ];
        }

        $booking = $this->bookShipment($shipment->fresh(), $option, $sync);

        return [
            'shipment' => $shipment->fresh(),
            'booking' => $booking->fresh(),
            'created' => $created,
            'message' => 'Shipment created and auto-booking started.',
            'status' => 'booking_processing',
        ];
    }

    public function cancelBooking(Shipment $shipment, array $data, bool $sync = false): Booking
    {
        $booking = $shipment->booking()->firstOrFail();
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
            'cancellation_reason_code' => $data['reason_code'] ?? null,
            'cancellation_reason_note' => $data['reason_note'] ?? null,
            'cancel_reason' => $data['reason'] ?? null,
        ]);
        $booking->shipment()->update(['status' => 'cancelled']);

        $carrier = Carrier::where('code', $booking->carrier_code)->first();
        if ($carrier && $carrier->type === 'internal') {
        } else {
            if ($sync) {
                CancelBookingJob::dispatchSync($booking->id, $data);
            } else {
                CancelBookingJob::dispatch($booking->id, $data);
            }
        }

        $changes = $this->activityLogService->diffChanges(
            $before,
            $booking->only(array_keys($before))
        );
        if (!empty($changes)) {
            $this->activityLogService->log(
                action: 'updated',
                entityType: 'booking',
                entity: $booking,
                accountId: $booking->account_id,
                merchantId: $booking->merchant_id,
                environmentId: $booking->environment_id,
                title: 'Booking cancelled',
                changes: $changes
            );
        }

        return $booking;
    }
}
