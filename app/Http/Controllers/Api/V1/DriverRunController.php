<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DriverRunResource;
use App\Http\Resources\DriverShipmentResource;
use App\Models\Run;
use App\Models\RunShipment;
use App\Services\DriverRunDataService;
use App\Support\ApiResponse;
use App\Support\RunActivityQuery;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class DriverRunController extends Controller
{
    public function query(Request $request): Builder
    {
        $driver = $request->user()->driver;
        abort_unless($driver && $driver->is_active && $driver->merchant && $driver->account_id === $request->user()->account_id, 403);

        $assignments = fn ($q) => $q->where('status', '!=', RunShipment::STATUS_REMOVED)
            ->whereHas('shipment', fn ($s) => $s->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id));
        $countStatus = fn (array $statuses) => function ($q) use ($assignments, $statuses) {
            $assignments($q);
            $q->whereHas('shipment', fn ($s) => $s->whereIn('status', $statuses));
        };
        $location = fn ($q) => $q->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id);

        app(\App\Services\RunReadinessService::class)->reconcile($driver->merchant_id);
        return Run::query()->where(fn ($q) => \App\Services\RunReadinessService::operational($q))->where('driver_id', $driver->id)->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->with(['merchant', 'driver.user', 'vehicle' => $location, 'originLocation' => $location, 'destinationLocation' => $location, 'latestEndRequest',
                'recordedEndStop' => $location, 'recordedEndStop.location' => $location,
            ])
            ->addSelect(['speeding_event_count' => RunActivityQuery::forRunRow()->selectRaw('COUNT(*)')->where('event_type', 'speeding')])
            ->withCount([
                'runShipments as shipment_count' => $assignments,
                'runShipments as delivered_count' => $countStatus(['delivered']),
                'runShipments as resolved_count' => $countStatus(['delivered', 'failed', 'cancelled', 'returned']),
            ]);
    }

    public function index(Request $request, DriverRunDataService $dataService)
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:active,completed'],
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:100'],
            'search' => ['nullable', 'string', 'max:200'],
            'sort' => ['nullable', 'in:default,newest,oldest'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);
        $query = $this->query($request);
        $completed = ($data['status'] ?? 'active') === 'completed';
        $query->whereIn('status', $completed ? [Run::STATUS_COMPLETED] : [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS]);
        if ($search = trim($data['search'] ?? '')) {
            $driver = $request->user()->driver;
            $query->where(function ($q) use ($search, $driver) {
                $id = preg_replace('/^run\s+/i', '', $search);
                if (ctype_digit($id)) {
                    $q->where('id', $id);
                }
                foreach (['vehicle' => ['plate_number', 'ref_code'], 'originLocation' => ['name'], 'destinationLocation' => ['name']] as $relation => $fields) {
                    $q->orWhereHas($relation, function ($related) use ($fields, $search, $driver) {
                        $related->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
                            ->where(function ($match) use ($fields, $search) {
                                foreach ($fields as $field) {
                                    $match->orWhereLike($field, '%'.$search.'%');
                                }
                            });
                    });
                }
            });
        }
        // Calendar days use the same merchant timezone as card timestamps.
        $dateColumn = $completed ? 'completed_at' : 'COALESCE(started_at, planned_start_at)';
        if (! empty($data['date'])) {
            $timezone = $request->user()->driver->merchant->timezone ?: config('app.timezone');
            $from = \Carbon\CarbonImmutable::createFromFormat('!Y-m-d', $data['date'], $timezone);
            $query->whereRaw($dateColumn.' >= ? AND '.$dateColumn.' < ?', [$from->utc(), $from->addDay()->utc()]);
        }
        $sort = $data['sort'] ?? 'default';
        if ($sort !== 'default' || $completed) {
            $direction = $sort === 'oldest' ? 'asc' : 'desc';
            $query->orderByRaw('CASE WHEN '.$dateColumn.' IS NULL THEN 1 ELSE 0 END')
                ->orderByRaw($dateColumn.' '.$direction)->orderBy('id', $direction);
        } else {
            $query->orderByRaw("CASE status WHEN 'in_progress' THEN 0 WHEN 'dispatched' THEN 1 ELSE 2 END")
                ->orderBy('started_at')->orderBy('planned_start_at')->orderBy('id');
        }
        $runs = $query->paginate($data['per_page'] ?? 20);
        $dataService->addStopCounts($runs->getCollection(), $request->user()->driver);

        return ApiResponse::paginated($runs, DriverRunResource::collection($runs));
    }

    public function show(Request $request, string $run_uuid, DriverRunDataService $data)
    {
        $run = $this->query($request)->where('uuid', $run_uuid)->where('status', '!=', Run::STATUS_CANCELLED)->firstOrFail();
        $driver = $request->user()->driver;
        $data->addStopCounts(new \Illuminate\Database\Eloquent\Collection([$run]), $driver);
        $shipments = $data->shipments($run, $driver);
        $timeline = $data->timeline($run, $driver, $shipments);

        return ApiResponse::success(array_merge((new DriverRunResource($run))->toArray($request), [
            'has_delivery_note' => $run->deliveryNoteImports()->where('account_id', $driver->account_id)
                ->where('merchant_id', $driver->merchant_id)->where('environment_id', $run->environment_id)->exists(),
            'shipments' => DriverShipmentResource::collection($shipments),
            'recorded_stops' => $timeline['recorded_stops'],
        ]));
    }
}
