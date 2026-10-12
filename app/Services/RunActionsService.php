<?php

namespace App\Services;

use App\Models\Location;
use App\Models\Run;
use App\Models\RunShipment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;

/** Controllers authorize and lock the run before entering these shared workflows. */
class RunActionsService
{
    public static function endpointRules(): array
    {
        return ['origin_location_id' => ['required', 'uuid'], 'destination_location_id' => ['required', 'uuid'],
            'expected_origin_location_id' => ['present', 'nullable', 'uuid'], 'expected_destination_location_id' => ['present', 'nullable', 'uuid']];
    }

    public static function orderRules(): array
    {
        return ['shipment_ids' => ['present', 'array', 'max:1000'], 'shipment_ids.*' => ['required', 'uuid', 'distinct'],
            'expected_shipment_ids' => ['present', 'array', 'max:1000'], 'expected_shipment_ids.*' => ['required', 'uuid', 'distinct']];
    }

    private function audit(Request $request, Run $run, string $action, array $changes): void
    {
        app(ActivityLogService::class)->log(action: $action, entityType: 'run', entity: $run, actor: $request->user(), accountId: $run->account_id, merchantId: $run->merchant_id, changes: $changes, title: str_replace('_', ' ', $action));
    }

    private function location(Request $request, Run $run, string $uuid): Location
    {
        $driver = $request->user()->role === 'driver' ? $request->user()->driver : null;
        $location = Location::where('uuid', $uuid)->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->first();
        if (! $location) {
            $candidate = $driver ? Cache::get("driver-trip-location:{$driver->id}:$uuid") : null;
            abort_unless($candidate && $candidate['account_id'] === $run->account_id && $candidate['merchant_id'] === $run->merchant_id, 422, 'This location selection expired or is unavailable. Search again.');
            $location = new Location($candidate);
        }
        abort_unless(! $location->environment_id || (int) $location->environment_id === (int) $run->environment_id, 422, 'Choose a location in this run environment.');
        abort_unless(is_numeric($location->latitude) && is_numeric($location->longitude) && abs((float) $location->latitude) <= 90 && abs((float) $location->longitude) <= 180, 422, 'Choose a location with a valid map position.');
        if (! $location->exists) {
            $location->save();
        }

        return $location;
    }

    public function endpoints(Request $request, Run $run, array $data): array
    {
        $before = ['origin_location_id' => $run->originLocation?->uuid, 'destination_location_id' => $run->destinationLocation?->uuid];
        $after = ['origin_location_id' => $data['origin_location_id'], 'destination_location_id' => $data['destination_location_id']];
        if ($before === $after) {
            return ['run_id' => $run->uuid] + $before;
        }
        abort_unless($before['origin_location_id'] === $data['expected_origin_location_id'] && $before['destination_location_id'] === $data['expected_destination_location_id'], 409, 'The run endpoints changed. Refresh and review them before saving.');
        $origin = $this->location($request, $run, $data['origin_location_id']);
        $destination = $this->location($request, $run, $data['destination_location_id']);
        $run->update(['origin_location_id' => $origin->id, 'destination_location_id' => $destination->id]);
        $this->audit($request, $run, 'run_endpoints_updated', ['before' => $before, 'after' => $after]);

        return ['run_id' => $run->uuid] + $after;
    }

    /** Remaining shipments use the same terminal-status rules as the planned timeline. */
    private function deliveryAssignments(Run $run)
    {
        return $run->runShipments()->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', fn ($q) => $q->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id))
            ->with(['shipment' => fn ($q) => $q->lockForUpdate(),
                'shipment.dropoffLocation' => fn ($q) => $q->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)])
            ->orderBy('sequence')->orderBy('id')->lockForUpdate()->get();
    }

    private function remaining($assignments)
    {
        return $assignments->filter(fn ($link) => ! in_array($link->shipment->status, ['delivered', 'failed', 'cancelled', 'returned'], true))->values();
    }

    public function deliveryOrder(Run $run): array
    {
        $remaining = $this->remaining($this->deliveryAssignments($run));

        return ['shipments' => $remaining->map(fn ($link) => [
            'shipment_id' => $link->shipment->uuid,
            'reference' => $link->shipment->merchant_order_ref ?: $link->shipment->delivery_note_number ?: 'Shipment',
            'destination' => $link->shipment->dropoffLocation?->name,
            'address' => $link->shipment->dropoffLocation?->full_address,
        ])->values()];
    }

    public function updateDeliveryOrder(Request $request, Run $run, array $data): array
    {
        $assignments = $this->deliveryAssignments($run);
        $remaining = $this->remaining($assignments);
        $before = $remaining->pluck('shipment.uuid')->all();
        $after = array_values($data['shipment_ids']);
        $expected = array_values($data['expected_shipment_ids']);
        abort_unless(collect($after)->sort()->values()->all() === collect($before)->sort()->values()->all(), 409, 'The remaining shipments changed. Reload the delivery order and try again.');
        // A repeated successful save is safe; a different stale draft must be reviewed.
        if ($before === $after) {
            return ['shipment_ids' => $after];
        }
        abort_unless($before === $expected, 409, 'The delivery order changed. Reload and review it before saving.');
        $byUuid = $remaining->keyBy('shipment.uuid');
        $index = 0;
        // Preserve completed/terminal entries in their slots and leave all delivery evidence intact.
        foreach ($assignments as $slot => $link) {
            $target = $byUuid->has($link->shipment->uuid) ? $byUuid[$after[$index++]] : $link;
            $target->update(['sequence' => $slot + 1]);
        }
        $this->audit($request, $run, 'run_delivery_order_updated', ['before' => $before, 'after' => $after]);

        return ['shipment_ids' => $after];
    }
}
