<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\DriverPresence;
use App\Models\UserDevice;

class DriverPresenceService
{
    public function __construct(
        private readonly UserDeviceService $userDeviceService,
        private readonly DeliveryOfferService $deliveryOfferService,
    ) {}

    public function heartbeat(Driver $driver, array $data): DriverPresence
    {
        $device = $this->resolveDevice($driver, $data);

        $presence = DriverPresence::firstOrNew(['driver_id' => $driver->id]);
        $presence->fill([
            'user_device_id' => $device?->id,
            'is_online' => (bool) $data['is_online'],
            'is_available' => array_key_exists('is_available', $data) ? (bool) $data['is_available'] : true,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'last_seen_at' => now(),
        ]);
        $presence->save();

        $this->deliveryOfferService->expireOverdueOffersForDriver($driver);

        return $presence->fresh(['userDevice', 'driver.user', 'driver.deliveryOffers.shipment.pickupLocation', 'driver.deliveryOffers.shipment.dropoffLocation', 'driver.deliveryOffers.shipment.requestedVehicleType']);
    }

    public function setOnlineStatus(Driver $driver, bool $isOnline): DriverPresence
    {
        $presence = DriverPresence::firstOrNew(['driver_id' => $driver->id]);
        $presence->fill([
            'is_online' => $isOnline,
            'is_available' => $isOnline ? $presence->is_available : false,
            'last_seen_at' => now(),
        ]);
        $presence->save();

        return $presence->fresh(['userDevice', 'driver.user']);
    }

    public function isOnline(Driver $driver): bool
    {
        $presence = $driver->presence;

        if (!$presence || !$presence->is_online || !$presence->last_seen_at) {
            return false;
        }

        $timeoutMinutes = (int) ($driver->merchant?->driver_offline_timeout_minutes ?? 120);

        return $presence->last_seen_at->copy()->addMinutes($timeoutMinutes)->isFuture();
    }

    private function resolveDevice(Driver $driver, array $data): ?UserDevice
    {
        if (!empty($data['user_device_id'])) {
            $device = $this->userDeviceService->resolveForUser($driver->user, $data['user_device_id']);
            if ($device) {
                return $device;
            }
        }

        if (!empty($data['platform']) || !empty($data['push_token']) || !empty($data['device_name'])) {
            return $this->userDeviceService->register($driver->user, $data);
        }

        return null;
    }
}
