<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\Carrier;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use Carbon\CarbonInterface;

class InternalBookingLifecycleService
{
    public function ensureBookingForShipment(Shipment $shipment, ?Run $run = null, ?CarbonInterface $bookedAt = null): Booking
    {
        $shipment->loadMissing('booking');

        $booking = $shipment->booking;

        if (!$booking) {
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
                'current_driver_id' => $run?->driver_id,
                'status' => 'booked',
                'carrier_code' => $carrier->code,
                'booked_at' => $bookedAt ?? now(),
            ]);
        } elseif ($run && $booking->current_driver_id !== $run->driver_id) {
            $booking->update(['current_driver_id' => $run->driver_id]);
            $booking->refresh();
        }

        if ($run && $run->status === Run::STATUS_IN_PROGRESS) {
            $booking = $this->markBookingInTransit($booking, $run->started_at ?? $bookedAt ?? now(), $run->driver_id);
        }

        return $booking->fresh();
    }

    public function syncRunBookingDrivers(Run $run): void
    {
        $run->loadMissing([
            'runShipments' => fn ($query) => $query
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->with('shipment.booking'),
        ]);

        foreach ($run->runShipments as $runShipment) {
            $shipment = $runShipment->shipment;
            if (!$shipment?->booking) {
                continue;
            }

            if ($shipment->booking->current_driver_id !== $run->driver_id) {
                $shipment->booking->update(['current_driver_id' => $run->driver_id]);
            }
        }
    }

    public function markRunShipmentsInTransit(Run $run, ?CarbonInterface $collectedAt = null): void
    {
        $run->loadMissing([
            'runShipments' => fn ($query) => $query
                ->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->with('shipment.booking'),
        ]);

        foreach ($run->runShipments as $runShipment) {
            $shipment = $runShipment->shipment;
            if (!$shipment) {
                continue;
            }

            if (!$shipment->booking && !(bool) $shipment->auto_created) {
                continue;
            }

            $booking = $shipment->booking ?: $this->ensureBookingForShipment($shipment, $run, $collectedAt ?? now());
            $this->markBookingInTransit($booking, $collectedAt ?? $run->started_at ?? now(), $run->driver_id);
        }
    }

    public function markShipmentDelivered(Shipment $shipment, ?CarbonInterface $deliveredAt = null): ?Booking
    {
        $shipment->loadMissing('booking');
        $booking = $shipment->booking;

        if (!$booking) {
            return null;
        }

        $updates = [];

        if ($booking->status !== 'delivered') {
            $updates['status'] = 'delivered';
        }

        if (!$booking->collected_at) {
            $updates['collected_at'] = $booking->booked_at ?? $deliveredAt ?? now();
        }

        if (!$booking->delivered_at) {
            $updates['delivered_at'] = $deliveredAt ?? now();
        }

        if (!empty($updates)) {
            $booking->update($updates);
        }

        return $booking->fresh();
    }

    public function backfillAutoShipmentBookings(): array
    {
        $summary = [
            'processed' => 0,
            'created' => 0,
            'in_transit' => 0,
            'delivered' => 0,
        ];

        Shipment::query()
            ->with(['booking', 'runShipments.run', 'currentRunShipment.run'])
            ->where('auto_created', true)
            ->whereDoesntHave('booking')
            ->orderBy('id')
            ->chunkById(100, function ($shipments) use (&$summary) {
                foreach ($shipments as $shipment) {
                    $summary['processed']++;

                    $run = $shipment->currentRunShipment?->run
                        ?? $shipment->runShipments
                            ->map->run
                            ->filter()
                            ->sortByDesc('started_at')
                            ->first();

                    $booking = $this->ensureBookingForShipment($shipment, $run, $shipment->created_at ?? now());
                    $summary['created']++;

                    if ($booking->status === 'in_transit') {
                        $summary['in_transit']++;
                    }

                    if ($shipment->status === 'delivered') {
                        $this->markShipmentDelivered($shipment, $shipment->updated_at ?? $shipment->created_at ?? now());
                        $summary['delivered']++;
                    }
                }
            });

        return $summary;
    }

    private function markBookingInTransit(Booking $booking, CarbonInterface $collectedAt, ?int $driverId = null): Booking
    {
        $updates = [];

        if ($booking->status !== 'in_transit' && !in_array($booking->status, ['delivered', 'cancelled', 'failed'], true)) {
            $updates['status'] = 'in_transit';
        }

        if (!$booking->collected_at) {
            $updates['collected_at'] = $collectedAt;
        }

        if ($booking->current_driver_id !== $driverId) {
            $updates['current_driver_id'] = $driverId;
        }

        if (!empty($updates)) {
            $booking->update($updates);
        }

        return $booking->fresh();
    }
}
