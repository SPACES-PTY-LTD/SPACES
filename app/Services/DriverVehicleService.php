<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\DriverVehicle;
use App\Models\Vehicle;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class DriverVehicleService
{
    public function listAssignments(array $filters, ?int $driverId = null, ?int $carrierId = null): LengthAwarePaginator
    {
        $query = DriverVehicle::with(['driver', 'vehicle.vehicleType']);

        if ($driverId) {
            $query->where('driver_id', $driverId);
        }

        if ($carrierId) {
            $query->whereHas('driver', fn ($driverQuery) => $driverQuery->where('carrier_id', $carrierId));
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query->orderByDesc('id')->paginate($perPage);
    }

    public function assignVehicle(Driver $driver, Vehicle $vehicle): DriverVehicle
    {
        $assignment = DriverVehicle::firstOrCreate([
            'driver_id' => $driver->id,
            'vehicle_id' => $vehicle->id,
        ]);

        $this->syncDriverVehicleType($driver, $vehicle);

        return $assignment->load(['driver', 'vehicle.vehicleType']);
    }

    public function getAssignment(Driver $driver, Vehicle $vehicle): DriverVehicle
    {
        return DriverVehicle::with(['driver', 'vehicle.vehicleType'])
            ->where('driver_id', $driver->id)
            ->where('vehicle_id', $vehicle->id)
            ->firstOrFail();
    }

    public function updateAssignment(Driver $driver, Vehicle $currentVehicle, Vehicle $nextVehicle): DriverVehicle
    {
        $assignment = DriverVehicle::where('driver_id', $driver->id)
            ->where('vehicle_id', $currentVehicle->id)
            ->firstOrFail();

        $assignment->vehicle_id = $nextVehicle->id;
        $assignment->save();

        $this->syncDriverVehicleType($driver, $nextVehicle);

        return $assignment->load(['driver', 'vehicle.vehicleType']);
    }

    public function removeAssignment(Driver $driver, Vehicle $vehicle): void
    {
        DriverVehicle::where('driver_id', $driver->id)
            ->where('vehicle_id', $vehicle->id)
            ->delete();
    }

    private function syncDriverVehicleType(Driver $driver, Vehicle $vehicle): void
    {
        if ($vehicle->is_active && $vehicle->vehicle_type_id) {
            $driver->update(['vehicle_type_id' => $vehicle->vehicle_type_id]);
        }
    }
}
