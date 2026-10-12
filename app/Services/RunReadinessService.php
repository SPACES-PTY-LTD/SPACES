<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Vehicle;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

/** One readiness contract for dispatch, driver selection and GPS processing. */
class RunReadinessService
{
    private static array $reconciling = [];

    public static function operational(Builder $query): void
    {
        $query->where(fn ($q) => $q->where('schedule_managed', false)
            ->orWhere('status', '!=', Run::STATUS_DRAFT));
    }

    public function reconcile(?int $merchantId): void
    {
        if (! $merchantId || isset(self::$reconciling[$merchantId])) {
            return;
        }
        self::$reconciling[$merchantId] = true;
        try {
            DB::transaction(function () use ($merchantId) {
                $merchant = Merchant::query()->lockForUpdate()->find($merchantId);
                if (! $merchant) {
                    return;
                }
                $candidates = Run::where('merchant_id', $merchantId)->where('schedule_managed', true)->whereIn('status', ['draft', 'dispatched'])->get(['driver_id', 'vehicle_id']);
                // GPS processing already locks vehicles; lock shared resources before selecting runs.
                Driver::whereIn('id', $candidates->pluck('driver_id')->filter())->orderBy('id')->lockForUpdate()->get();
                Vehicle::whereIn('id', $candidates->pluck('vehicle_id')->filter())->orderBy('id')->lockForUpdate()->get();
                $runs = Run::query()->where('merchant_id', $merchantId)
                    ->whereIn('status', [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS])
                    ->with(['merchant', 'driver', 'vehicle', 'runShipments.shipment'])
                    ->orderBy('planned_start_at')->orderBy('id')->lockForUpdate()->get();
                $occupiedDrivers = [];
                $occupiedVehicles = [];
                foreach (Run::where('account_id', $merchant->account_id)->where('merchant_id', '!=', $merchantId)->whereIn('status', ['dispatched', 'in_progress'])->get(['driver_id', 'vehicle_id']) as $other) {
                    if ($other->driver_id) {
                        $occupiedDrivers[$other->driver_id] = true;
                    }
                    if ($other->vehicle_id) {
                        $occupiedVehicles[$other->vehicle_id] = true;
                    }
                }
                // Legacy ready work and every active run keep their resources.
                foreach ($runs as $run) {
                    if ($run->status === Run::STATUS_IN_PROGRESS || (! $run->schedule_managed && $run->status === Run::STATUS_DISPATCHED)) {
                        if ($run->driver_id) {
                            $occupiedDrivers[$run->driver_id] = true;
                        }
                        if ($run->vehicle_id) {
                            $occupiedVehicles[$run->vehicle_id] = true;
                        }
                    }
                }
                foreach ($runs as $run) {
                    if (! $run->schedule_managed || $run->status === Run::STATUS_IN_PROGRESS) {
                        continue;
                    }
                    $reason = $this->prerequisiteReason($run);
                    if (! $reason && (isset($occupiedDrivers[$run->driver_id]) || isset($occupiedVehicles[$run->vehicle_id]))) {
                        $reason = 'Waiting for the driver or truck to finish another run.';
                    }
                    $status = $reason ? Run::STATUS_DRAFT : Run::STATUS_DISPATCHED;
                    $changed = $run->status !== $status;
                    if ($changed) {
                        $run->update(['status' => $status]);
                    }
                    if ($status === Run::STATUS_DISPATCHED) {
                        $occupiedDrivers[$run->driver_id] = true;
                        $occupiedVehicles[$run->vehicle_id] = true;
                        if ($changed) {
                            app(DriverVehicleService::class)->assignVehicle($run->driver, $run->vehicle);
                            app(InternalBookingLifecycleService::class)->syncRunBookingDrivers($run);
                        }
                    }
                }
            }, 5);
        } finally {
            unset(self::$reconciling[$merchantId]);
        }
    }

    public function prerequisiteReason(Run $run): ?string
    {
        $timezone = $run->merchant?->timezone ?: config('app.timezone', 'UTC');
        if (! $run->planned_start_at) {
            return 'Set a planned start date and time.';
        }
        if ($run->planned_start_at->copy()->timezone($timezone)->toDateString() > now($timezone)->toDateString()) {
            return 'Scheduled for a future day.';
        }
        if (! $run->driver_id || ! $run->driver?->is_active) {
            return 'Assign an active driver.';
        }
        if (! $run->vehicle_id || ! $run->vehicle?->is_active || $run->vehicle?->maintenance_mode_at) {
            return 'Assign an available truck.';
        }
        if (! $run->origin_location_id || ! $run->destination_location_id) {
            return 'Choose start and end locations.';
        }
        $eligible = $run->runShipments->contains(fn ($assignment) => $assignment->status !== RunShipment::STATUS_REMOVED
            && $assignment->shipment && ! in_array($assignment->shipment->status, ['delivered', 'failed', 'cancelled', 'returned'], true));

        return $eligible ? null : 'Add at least one unfinished shipment.';
    }

    public function waitingReason(Run $run): ?string
    {
        if (! $run->schedule_managed || $run->status !== Run::STATUS_DRAFT) {
            return null;
        }

        return $this->prerequisiteReason($run) ?? 'Waiting for an earlier run or an occupied driver/truck.';
    }

    public function assertReady(Run $run): void
    {
        if (! $run->schedule_managed) {
            return;
        }
        $this->reconcile($run->merchant_id);
        $run->refresh();
        if ($run->status !== Run::STATUS_DISPATCHED) {
            throw new ConflictHttpException($this->waitingReason($run) ?? 'This planned run is not ready.');
        }
    }
}
