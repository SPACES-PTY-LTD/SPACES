<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdditionalCostResource;
use App\Models\Location;
use App\Models\Run;
use App\Models\RunCost;
use App\Models\RunShipment;
use App\Services\ActivityLogService;
use App\Services\ConversationService;
use App\Support\ApiResponse;
use App\Support\CostMoney;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DriverRunActionsController extends Controller
{
    private function owned(Request $request, string $uuid): Run
    {
        $driver = $request->user()->driver;
        abort_unless($driver && $driver->is_active && $driver->merchant && $driver->account_id === $request->user()->account_id, 403);

        return Run::where('uuid', $uuid)->where('driver_id', $driver->id)->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)->lockForUpdate()->firstOrFail();
    }

    private function active(Run $run): void
    {
        abort_unless($run->status === Run::STATUS_IN_PROGRESS, 409, 'This run is no longer active. Refresh the dashboard.');
    }

    private function audit(Request $request, Run $run, string $action, array $changes): void
    {
        app(ActivityLogService::class)->log(action: $action, entityType: 'run', entity: $run, actor: $request->user(), changes: $changes, title: str_replace('_', ' ', $action));
    }

    public function requestEnd(Request $request, string $run_uuid)
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000', 'regex:/\S/u']]);

        return DB::transaction(function () use ($request, $run_uuid, $data) {
            $run = $this->owned($request, $run_uuid);
            $this->active($run);
            $existing = $run->endRequests()->where('status', 'pending')->first();
            if ($existing) {
                return ApiResponse::success($existing->toSummary());
            }
            $entry = $run->endRequests()->create(['status' => 'pending', 'requested_by' => $request->user()->id, 'reason' => trim($data['reason'])]);
            app(ConversationService::class)->runEndRequested($request->user(), $run, $entry);
            $this->audit($request, $run, 'run_end_requested', ['after' => $entry->toSummary()]);

            return ApiResponse::success($entry->toSummary(), [], 201);
        });
    }

    private function location(Request $request, Run $run, string $uuid): Location
    {
        $driver = $request->user()->driver;
        $location = Location::where('uuid', $uuid)->where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->first();
        if (! $location) {
            $candidate = Cache::get("driver-trip-location:{$driver->id}:$uuid");
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

    public function endpoints(Request $request, string $run_uuid)
    {
        $data = $request->validate(['origin_location_id' => ['required', 'uuid'], 'destination_location_id' => ['required', 'uuid'],
            'expected_origin_location_id' => ['present', 'nullable', 'uuid'], 'expected_destination_location_id' => ['present', 'nullable', 'uuid']]);

        return DB::transaction(function () use ($request, $run_uuid, $data) {
            $run = $this->owned($request, $run_uuid);
            $this->active($run);
            $before = ['origin_location_id' => $run->originLocation?->uuid, 'destination_location_id' => $run->destinationLocation?->uuid];
            $after = ['origin_location_id' => $data['origin_location_id'], 'destination_location_id' => $data['destination_location_id']];
            if ($before === $after) {
                return ApiResponse::success(['run_id' => $run->uuid] + $before);
            }
            abort_unless($before['origin_location_id'] === $data['expected_origin_location_id'] && $before['destination_location_id'] === $data['expected_destination_location_id'], 409, 'The run endpoints changed. Refresh and review them before saving.');
            $origin = $this->location($request, $run, $data['origin_location_id']);
            $destination = $this->location($request, $run, $data['destination_location_id']);
            $run->update(['origin_location_id' => $origin->id, 'destination_location_id' => $destination->id]);
            $this->audit($request, $run, 'run_endpoints_updated', ['before' => $before, 'after' => $after]);

            return ApiResponse::success(['run_id' => $run->uuid] + $after);
        });
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

    public function deliveryOrder(Request $request, string $run_uuid)
    {
        return DB::transaction(function () use ($request, $run_uuid) {
            $run = $this->owned($request, $run_uuid);
            $this->active($run);
            $remaining = $this->remaining($this->deliveryAssignments($run));

            return ApiResponse::success(['shipments' => $remaining->map(fn ($link) => [
                'shipment_id' => $link->shipment->uuid,
                'reference' => $link->shipment->merchant_order_ref ?: $link->shipment->delivery_note_number ?: 'Shipment',
                'destination' => $link->shipment->dropoffLocation?->name,
                'address' => $link->shipment->dropoffLocation?->full_address,
            ])->values()]);
        });
    }

    public function updateDeliveryOrder(Request $request, string $run_uuid)
    {
        $data = $request->validate([
            'shipment_ids' => ['present', 'array', 'max:1000'], 'shipment_ids.*' => ['required', 'uuid', 'distinct'],
            'expected_shipment_ids' => ['present', 'array', 'max:1000'], 'expected_shipment_ids.*' => ['required', 'uuid', 'distinct'],
        ]);

        return DB::transaction(function () use ($request, $run_uuid, $data) {
            $run = $this->owned($request, $run_uuid);
            $this->active($run);
            $assignments = $this->deliveryAssignments($run);
            $remaining = $this->remaining($assignments);
            $before = $remaining->pluck('shipment.uuid')->all();
            $after = array_values($data['shipment_ids']);
            $expected = array_values($data['expected_shipment_ids']);
            abort_unless(collect($after)->sort()->values()->all() === collect($before)->sort()->values()->all(), 409, 'The remaining shipments changed. Reload the delivery order and try again.');
            // A repeated successful save is safe; a different stale draft must be reviewed.
            if ($before === $after) {
                return ApiResponse::success(['shipment_ids' => $after]);
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

            return ApiResponse::success(['shipment_ids' => $after]);
        });
    }

    public function cost(Request $request, string $run_uuid)
    {
        $data = $request->validate(['title' => ['required', 'string', 'max:255', 'regex:/\S/u'], 'amount' => ['required', 'string'],
            'client_request_id' => ['required', 'uuid'], 'currency' => ['prohibited'], 'source' => ['prohibited'], 'location_cost_id' => ['prohibited']]);
        $amount = CostMoney::validateAmount($data['amount'], 'ZAR');
        abort_unless(CostMoney::units($amount) > 0, 422, 'Amount must be greater than zero.');

        return DB::transaction(function () use ($request, $run_uuid, $data, $amount) {
            $run = $this->owned($request, $run_uuid);
            $existing = RunCost::withTrashed()->where('client_request_id', $data['client_request_id'])->first();
            if ($existing) {
                abort_unless($existing->run_id === $run->id && $existing->created_by === $request->user()->id && $existing->title === trim($data['title']) && CostMoney::units($existing->amount) === CostMoney::units($amount), 409, 'This retry identifier was already used for a different cost.');

                return ApiResponse::success(new AdditionalCostResource($existing));
            }
            $this->active($run);
            $cost = $run->additionalCosts()->create(['client_request_id' => $data['client_request_id'], 'title' => trim($data['title']), 'amount' => $amount,
                'currency' => 'ZAR', 'source' => 'manual', 'created_by' => $request->user()->id, 'updated_by' => $request->user()->id]);
            $this->audit($request, $run, 'additional_cost_created', ['after' => (new AdditionalCostResource($cost))->resolve($request)]);

            return ApiResponse::success(new AdditionalCostResource($cost), [], 201);
        });
    }
}
