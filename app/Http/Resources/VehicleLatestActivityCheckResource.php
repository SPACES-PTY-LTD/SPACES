<?php

namespace App\Http\Resources;

use App\Models\VehicleActivity;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class VehicleLatestActivityCheckResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $activity = $this->relationLoaded('latestVehicleActivity')
            ? $this->getRelation('latestVehicleActivity')
            : null;
        $monitoringActivity = $this->relationLoaded('latestMonitoringActivity')
            ? $this->getRelation('latestMonitoringActivity')
            : null;
        $merchant = $this->relationLoaded('resolvedMerchant')
            ? $this->getRelation('resolvedMerchant')
            : null;
        $run = $activity?->run;
        $driver = $run?->driver;
        $driverUser = $driver?->user;
        $lastDriver = $this->relationLoaded('lastDriver')
            ? $this->getRelation('lastDriver')
            : null;
        $lastDriverUser = $lastDriver?->relationLoaded('user') ? $lastDriver->user : null;
        $fleetStatus = $this->maintenance_mode_at !== null
            ? 'maintenance'
            : (((int) ($this->qualifying_active_runs_count ?? 0)) > 0 ? 'active' : 'standby');
        $monitoringIsExit = $monitoringActivity?->event_type === VehicleActivity::EVENT_EXITED_LOCATION
            || ($monitoringActivity?->event_type === VehicleActivity::EVENT_ENTERED_LOCATION && $monitoringActivity?->exited_at !== null);
        $monitoringSince = $monitoringIsExit
            ? ($monitoringActivity?->exited_at ?? $monitoringActivity?->occurred_at ?? $monitoringActivity?->created_at)
            : ($monitoringActivity?->entered_at ?? $monitoringActivity?->occurred_at ?? $monitoringActivity?->created_at);
        $monitoringStatus = match (true) {
            $monitoringActivity === null => 'unknown',
            $monitoringIsExit => 'in_transit',
            $monitoringSince?->lte(now()->subHours(48)) => 'standby',
            default => 'at_location',
        };

        return [
            'activity_id' => $activity?->uuid,
            'merchant' => $merchant ? [
                'merchant_id' => $merchant->uuid,
                'name' => $merchant->name,
                'status' => $merchant->status,
            ] : null,
            'vehicle' => [
                'vehicle_id' => $this->uuid,
                'plate_number' => $this->plate_number,
                'ref_code' => $this->ref_code,
                'make' => $this->make,
                'model' => $this->model,
                'is_active' => (bool) $this->is_active,
                'fleet_status' => $fleetStatus,
                'last_driver_id' => $lastDriver?->uuid,
                'driver_logged_at' => optional($this->driver_logged_at)?->toIso8601String(),
                'last_driver' => $lastDriver ? [
                    'driver_id' => $lastDriver->uuid,
                    'name' => $lastDriverUser?->name,
                    'email' => $lastDriverUser?->email,
                    'telephone' => $lastDriverUser?->telephone,
                    'intergration_id' => $lastDriver->intergration_id,
                    'is_active' => (bool) $lastDriver->is_active,
                ] : null,
            ],
            'monitoring' => [
                'status' => $monitoringStatus,
                'since_at' => optional($monitoringSince)?->toIso8601String(),
                'location' => $monitoringActivity?->location ? [
                    'location_id' => $monitoringActivity->location->uuid,
                    'name' => $monitoringActivity->location->name,
                    'company' => $monitoringActivity->location->company,
                    'code' => $monitoringActivity->location->code,
                    'type' => $monitoringActivity->location->locationType ? [
                        'title' => $monitoringActivity->location->locationType->title,
                        'slug' => $monitoringActivity->location->locationType->slug,
                        'icon' => $monitoringActivity->location->locationType->icon,
                    ] : null,
                    'full_address' => $monitoringActivity->location->full_address,
                    'city' => $monitoringActivity->location->city,
                    'province' => $monitoringActivity->location->province,
                    'country' => $monitoringActivity->location->country,
                ] : null,
                'source_activity_id' => $monitoringActivity?->uuid,
                'source_event_type' => $monitoringActivity?->event_type,
            ],
            'location' => $activity?->location ? [
                'location_id' => $activity->location->uuid,
                'name' => $activity->location->name,
                'company' => $activity->location->company,
                'code' => $activity->location->code,
                'full_address' => $activity->location->full_address,
                'city' => $activity->location->city,
                'province' => $activity->location->province,
                'country' => $activity->location->country,
            ] : null,
            'run_id' => $run?->uuid,
            'driver' => $driver ? [
                'driver_id' => $driver->uuid,
                'name' => $driverUser?->name,
                'email' => $driverUser?->email,
                'telephone' => $driverUser?->telephone,
                'intergration_id' => $driver->intergration_id,
                'is_active' => (bool) $driver->is_active,
            ] : null,
            'shipment' => $activity?->shipment ? [
                'shipment_id' => $activity->shipment->uuid,
                'merchant_order_ref' => $activity->shipment->merchant_order_ref,
                'status' => $activity->shipment->status,
                'auto_created' => (bool) $activity->shipment->auto_created,
            ] : null,
            'event_type' => $activity?->event_type,
            'occurred_at' => optional($activity?->occurred_at)?->toIso8601String(),
            'entered_at' => optional($activity?->entered_at)?->toIso8601String(),
            'exited_at' => optional($activity?->exited_at)?->toIso8601String(),
            'latitude' => $activity?->latitude !== null ? (float) $activity->latitude : null,
            'longitude' => $activity?->longitude !== null ? (float) $activity->longitude : null,
            'speed_kph' => $activity?->speed_kph !== null ? (float) $activity->speed_kph : null,
            'speed_limit_kph' => $activity?->speed_limit_kph !== null ? (float) $activity->speed_limit_kph : null,
            'exit_reason' => $activity?->exit_reason,
            'metadata' => $activity?->metadata,
            'created_at' => optional($activity?->created_at)?->toIso8601String(),
        ];
    }
}
