<?php

namespace App\Services;

use App\Jobs\ExpireDeliveryOfferJob;
use App\Jobs\SendOfferFailedEmailJob;
use App\Models\Booking;
use App\Models\Carrier;
use App\Models\DeliveryOffer;
use App\Models\Driver;
use App\Models\DriverPresence;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class DeliveryOfferService
{
    public function __construct(
        private readonly RunService $runService,
    ) {}

    public function startOffersForShipment(Shipment $shipment): ?DeliveryOffer
    {
        $shipment->loadMissing(['merchant', 'environment', 'pickupLocation', 'dropoffLocation', 'requestedVehicleType', 'deliveryOffers']);

        if (!$shipment->auto_assign || !$this->isOfferableShipment($shipment)) {
            return null;
        }

        $currentPending = $shipment->deliveryOffers()->where('status', DeliveryOffer::STATUS_PENDING)->latest('id')->first();
        if ($currentPending && $currentPending->expires_at->isFuture()) {
            return $this->loadOffer($currentPending);
        }

        return $this->offerNextDriver($shipment);
    }

    public function offerNextDriver(Shipment $shipment): ?DeliveryOffer
    {
        $shipment->loadMissing(['merchant', 'environment', 'pickupLocation', 'dropoffLocation', 'requestedVehicleType']);

        if (!$this->isOfferableShipment($shipment)) {
            return null;
        }

        $candidate = $this->eligibleDrivers($shipment)->first();

        if (!$candidate) {
            $this->markShipmentOfferFailed($shipment);

            return null;
        }

        $existingCount = DeliveryOffer::where('shipment_id', $shipment->id)->count();
        $expiresAt = now()->addMinutes((int) ($shipment->merchant->delivery_offers_expiry_time ?? 1));

        $offer = DeliveryOffer::create([
            'account_id' => $shipment->account_id,
            'merchant_id' => $shipment->merchant_id,
            'environment_id' => $shipment->environment_id,
            'shipment_id' => $shipment->id,
            'driver_id' => $candidate->id,
            'user_device_id' => $candidate->presence?->user_device_id,
            'status' => DeliveryOffer::STATUS_PENDING,
            'sequence' => $existingCount + 1,
            'offered_at' => now(),
            'expires_at' => $expiresAt,
            'notification_payload' => [
                'shipment_uuid' => $shipment->uuid,
                'offer_uuid' => null,
                'expires_at' => $expiresAt->toIso8601String(),
                'merchant_order_ref' => $shipment->merchant_order_ref,
                'delivery_note_number' => $shipment->delivery_note_number,
                'pickup_address' => $shipment->pickupLocation?->full_address,
                'dropoff_address' => $shipment->dropoffLocation?->full_address,
            ],
        ]);

        $offer->update([
            'notification_payload' => array_merge($offer->notification_payload ?? [], [
                'offer_uuid' => $offer->uuid,
            ]),
        ]);

        $candidate->presence?->update(['last_offered_at' => now()]);

        Log::info('Delivery offer created', [
            'offer_id' => $offer->uuid,
            'shipment_id' => $shipment->uuid,
            'driver_id' => $candidate->uuid,
            'expires_at' => $expiresAt->toIso8601String(),
        ]);

        ExpireDeliveryOfferJob::dispatch($offer->id)->delay($expiresAt)->afterCommit();

        return $this->loadOffer($offer);
    }

    public function acceptOffer(DeliveryOffer $offer, Driver $driver): array
    {
        return DB::transaction(function () use ($offer, $driver) {
            $offer = DeliveryOffer::whereKey($offer->id)->lockForUpdate()->firstOrFail();

            if ($offer->driver_id !== $driver->id) {
                throw new ConflictHttpException('This offer does not belong to the authenticated driver.');
            }

            if ($offer->status !== DeliveryOffer::STATUS_PENDING || $offer->expires_at->isPast()) {
                throw new ConflictHttpException('This offer is no longer available.');
            }

            $shipment = Shipment::whereKey($offer->shipment_id)->lockForUpdate()->firstOrFail();
            if (!$this->isOfferableShipment($shipment)) {
                throw new ConflictHttpException('Shipment is no longer available for acceptance.');
            }

            if ($shipment->booking()->exists()) {
                throw new ConflictHttpException('Shipment already has a booking.');
            }

            $offer->update([
                'status' => DeliveryOffer::STATUS_ACCEPTED,
                'responded_at' => now(),
            ]);

            DeliveryOffer::where('shipment_id', $shipment->id)
                ->where('id', '!=', $offer->id)
                ->where('status', DeliveryOffer::STATUS_PENDING)
                ->update([
                    'status' => DeliveryOffer::STATUS_CANCELLED,
                    'responded_at' => now(),
                    'response_reason' => 'Another driver accepted the shipment.',
                ]);

            $carrier = Carrier::firstOrCreate(
                ['code' => 'internal'],
                ['name' => 'Internal', 'type' => 'internal', 'enabled' => true, 'merchant_id' => $shipment->merchant_id]
            );

            $booking = Booking::create([
                'account_id' => $shipment->account_id,
                'merchant_id' => $shipment->merchant_id,
                'environment_id' => $shipment->environment_id,
                'shipment_id' => $shipment->id,
                'quote_option_id' => null,
                'current_driver_id' => $driver->id,
                'status' => 'booked',
                'carrier_code' => $carrier->code,
                'booked_at' => now(),
            ]);

            $run = $this->runService->createRun([
                'merchant_id' => $shipment->merchant->uuid,
                'environment_id' => $shipment->environment?->uuid,
                'driver_id' => $driver->uuid,
            ], $shipment->environment);

            $this->runService->attachShipments($run, [$shipment->uuid]);

            $shipment->update(['status' => 'booked']);

            return [
                'offer' => $this->loadOffer($offer->fresh()),
                'shipment' => $shipment->fresh([
                    'merchant',
                    'environment',
                    'pickupLocation',
                    'dropoffLocation',
                    'requestedVehicleType',
                    'currentRunShipment.run.driver.user',
                    'currentRunShipment.run.vehicle.lastDriver.user',
                    'booking',
                ]),
                'booking' => $booking->fresh(),
            ];
        });
    }

    public function declineOffer(DeliveryOffer $offer, Driver $driver, ?string $reason = null): ?DeliveryOffer
    {
        return DB::transaction(function () use ($offer, $driver, $reason) {
            $offer = DeliveryOffer::whereKey($offer->id)->lockForUpdate()->firstOrFail();

            if ($offer->driver_id !== $driver->id) {
                throw new ConflictHttpException('This offer does not belong to the authenticated driver.');
            }

            if ($offer->status !== DeliveryOffer::STATUS_PENDING) {
                throw new ConflictHttpException('This offer is no longer pending.');
            }

            $offer->update([
                'status' => DeliveryOffer::STATUS_DECLINED,
                'responded_at' => now(),
                'response_reason' => $reason,
            ]);

            return $this->offerNextDriver($offer->shipment()->firstOrFail());
        });
    }

    public function expireOfferById(int $offerId): ?DeliveryOffer
    {
        return DB::transaction(function () use ($offerId) {
            $offer = DeliveryOffer::whereKey($offerId)->lockForUpdate()->first();
            if (!$offer || $offer->status !== DeliveryOffer::STATUS_PENDING) {
                return null;
            }

            if ($offer->expires_at->isFuture()) {
                return $this->loadOffer($offer);
            }

            $offer->update([
                'status' => DeliveryOffer::STATUS_EXPIRED,
                'responded_at' => now(),
                'response_reason' => 'Offer expired before response.',
            ]);

            return $this->offerNextDriver($offer->shipment()->firstOrFail());
        });
    }

    public function expireOverdueOffersForDriver(Driver $driver): void
    {
        $offerIds = DeliveryOffer::where('driver_id', $driver->id)
            ->where('status', DeliveryOffer::STATUS_PENDING)
            ->where('expires_at', '<=', now())
            ->pluck('id');

        foreach ($offerIds as $offerId) {
            $this->expireOfferById($offerId);
        }
    }

    public function activeOffersForDriver(Driver $driver): Collection
    {
        $this->expireOverdueOffersForDriver($driver);

        return DeliveryOffer::with([
            'shipment.pickupLocation',
            'shipment.dropoffLocation',
            'shipment.requestedVehicleType',
            'driver.user',
        ])
            ->where('driver_id', $driver->id)
            ->where('status', DeliveryOffer::STATUS_PENDING)
            ->where('expires_at', '>', now())
            ->orderBy('offered_at')
            ->get();
    }

    private function eligibleDrivers(Shipment $shipment): Collection
    {
        $merchant = $shipment->merchant;
        $attemptedDriverIds = DeliveryOffer::where('shipment_id', $shipment->id)->pluck('driver_id');
        $maxDistance = $merchant->max_driver_distance;

        $drivers = Driver::query()
            ->with(['user', 'presence'])
            ->where('merchant_id', $merchant->id)
            ->where('is_active', true)
            ->whereNotIn('id', $attemptedDriverIds)
            ->whereDoesntHave('deliveryOffers', function (Builder $builder) {
                $builder->where('status', DeliveryOffer::STATUS_PENDING)
                    ->where('expires_at', '>', now());
            })
            ->whereDoesntHave('runs', function (Builder $builder) {
                $builder->where('status', Run::STATUS_IN_PROGRESS)
                    ->whereHas('runShipments.shipment', function (Builder $shipmentBuilder) {
                        $shipmentBuilder->whereNotIn('status', ['cancelled', 'delivered', 'failed']);
                    });
            })
            ->get()
            ->filter(function (Driver $driver) use ($shipment, $maxDistance) {
                $presence = $driver->presence;
                if (!$presence || !$presence->is_online || !$presence->is_available || !$presence->last_seen_at) {
                    return false;
                }

                $timeoutMinutes = (int) ($driver->merchant?->driver_offline_timeout_minutes ?? 120);
                if ($presence->last_seen_at->copy()->addMinutes($timeoutMinutes)->isPast()) {
                    return false;
                }

                if ($shipment->requested_vehicle_type_id && (int) $driver->vehicle_type_id !== (int) $shipment->requested_vehicle_type_id) {
                    return false;
                }

                if ($maxDistance === null) {
                    return true;
                }

                if ($presence->latitude === null || $presence->longitude === null) {
                    return false;
                }

                $pickupLat = $shipment->pickupLocation?->latitude;
                $pickupLng = $shipment->pickupLocation?->longitude;
                if ($pickupLat === null || $pickupLng === null) {
                    return false;
                }

                return $this->distanceInKm(
                    (float) $presence->latitude,
                    (float) $presence->longitude,
                    (float) $pickupLat,
                    (float) $pickupLng,
                ) <= (float) $maxDistance;
            })
            ->sortBy(function (Driver $driver) use ($shipment) {
                $presence = $driver->presence;
                $pickupLat = (float) ($shipment->pickupLocation?->latitude ?? 0);
                $pickupLng = (float) ($shipment->pickupLocation?->longitude ?? 0);

                if ($presence?->latitude === null || $presence?->longitude === null || $pickupLat === 0.0 || $pickupLng === 0.0) {
                    return PHP_INT_MAX;
                }

                return $this->distanceInKm((float) $presence->latitude, (float) $presence->longitude, $pickupLat, $pickupLng);
            })
            ->values();

        return $drivers;
    }

    private function isOfferableShipment(Shipment $shipment): bool
    {
        return !$shipment->booking
            && !in_array($shipment->status, ['cancelled', 'delivered', 'failed'], true);
    }

    private function markShipmentOfferFailed(Shipment $shipment): void
    {
        $shipment->update(['status' => 'offer_failed']);

        if (!empty($shipment->merchant?->support_email)) {
            SendOfferFailedEmailJob::dispatch($shipment->id)->afterCommit();
        }
    }

    private function loadOffer(DeliveryOffer $offer): DeliveryOffer
    {
        return $offer->fresh([
            'driver.user',
            'shipment.pickupLocation',
            'shipment.dropoffLocation',
            'shipment.requestedVehicleType',
        ]);
    }

    private function distanceInKm(float $latA, float $lngA, float $latB, float $lngB): float
    {
        $earthRadius = 6371;
        $deltaLat = deg2rad($latB - $latA);
        $deltaLng = deg2rad($lngB - $lngA);

        $a = sin($deltaLat / 2) ** 2
            + cos(deg2rad($latA)) * cos(deg2rad($latB)) * sin($deltaLng / 2) ** 2;

        return $earthRadius * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
