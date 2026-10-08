<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DriverRunResource;
use App\Http\Resources\DriverShipmentResource;
use App\Models\Run;
use App\Models\RunShipment;
use App\Services\DriverRunDataService;
use App\Support\ApiResponse;
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

        return Run::query()->where('driver_id', $driver->id)->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)
            ->with(['merchant', 'driver.user', 'vehicle' => $location, 'originLocation' => $location, 'destinationLocation' => $location, 'latestEndRequest',
                'recordedEndStop' => $location, 'recordedEndStop.location' => $location,
            ])
            ->withCount([
                'runShipments as shipment_count' => $assignments,
                'runShipments as delivered_count' => $countStatus(['delivered']),
                'runShipments as resolved_count' => $countStatus(['delivered', 'failed', 'cancelled', 'returned']),
            ]);
    }

    public function index(Request $request)
    {
        $data = $request->validate(['status' => ['sometimes', 'in:active,completed'], 'page' => ['sometimes', 'integer', 'min:1'], 'per_page' => ['sometimes', 'integer', 'min:1', 'max:100']]);
        $query = $this->query($request);
        if (($data['status'] ?? 'active') === 'completed') {
            $query->where('status', Run::STATUS_COMPLETED)->orderByDesc('completed_at')->orderByDesc('id');
        } else {
            $query->whereIn('status', [Run::STATUS_DRAFT, Run::STATUS_DISPATCHED, Run::STATUS_IN_PROGRESS])
                ->orderByRaw("CASE status WHEN 'in_progress' THEN 0 WHEN 'dispatched' THEN 1 ELSE 2 END")
                ->orderBy('started_at')->orderBy('planned_start_at')->orderBy('id');
        }
        $runs = $query->paginate($data['per_page'] ?? 20);

        return ApiResponse::paginated($runs, DriverRunResource::collection($runs));
    }

    public function show(Request $request, string $run_uuid, DriverRunDataService $data)
    {
        $run = $this->query($request)->where('uuid', $run_uuid)->where('status', '!=', Run::STATUS_CANCELLED)->firstOrFail();
        $driver = $request->user()->driver;
        $shipments = $data->shipments($run, $driver);
        $timeline = $data->timeline($run, $driver, $shipments);

        return ApiResponse::success(array_merge((new DriverRunResource($run))->toArray($request), [
            'shipments' => DriverShipmentResource::collection($shipments),
            'recorded_stops' => $timeline['recorded_stops'],
        ]));
    }
}
