<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDriverDocumentImportRequest;
use App\Models\DeliveryNoteImport;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\Location;
use App\Models\TrackingEvent;
use App\Models\VehicleActivity;
use App\Services\DriverImportReviewService;
use App\Services\InternalBookingLifecycleService;
use App\Services\DeliveryNoteImportService;
use App\Services\RunService;
use App\Services\ShipmentService;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DriverDocumentImportController extends Controller
{
    private function driver(Request $request)
    {
        $driver = $request->user()->driver;
        abort_unless($driver && $driver->is_active && $driver->merchant && $driver->account_id === $request->user()->account_id, 403);

        return $driver;
    }

    private function runs($driver)
    {
        return Run::where('driver_id', $driver->id)->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)->whereIn('status', ['draft', 'dispatched', 'in_progress']);
    }

    private function owned(Request $request, string $id)
    {
        $driver = $this->driver($request);

        return DeliveryNoteImport::where('uuid', $id)->where('uploaded_by_user_id', $request->user()->id)
            ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->firstOrFail();
    }

    public function context(Request $request)
    {
        $driver = $this->driver($request);
        $timezone = $driver->merchant->timezone ?: config('app.timezone');

        return ApiResponse::success([
            'today' => now($timezone)->toDateString(), 'timezone' => $timezone,
            'vehicles' => $driver->vehicles()->where('vehicles.account_id', $driver->account_id)->where('vehicles.merchant_id', $driver->merchant_id)->get()->map(fn ($v) => ['vehicle_id' => $v->uuid, 'label' => $v->plate_number ?? $v->registration_number ?? $v->uuid]),
            'locations' => Location::where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->orderBy('name')->limit(100)->get()->merge(Location::where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->whereIn('id', $this->runs($driver)->get()->flatMap(fn ($r) => [$r->origin_location_id, $r->destination_location_id])->filter())->get())->unique('id')->values()->map(fn ($l) => $l->toAddressArray()),
            'recent_imports' => DeliveryNoteImport::where('uploaded_by_user_id', $request->user()->id)
                ->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
                ->whereIn('status', ['analyzed', 'confirmed'])->latest('id')->limit(5)->get()
                ->map(fn ($import) => ['import_id' => $import->uuid, 'filename' => $import->original_name, 'status' => $import->status]),
            'runs' => $this->runs($driver)->latest('id')->get()->map(fn ($run) => [
                'run_id' => $run->uuid, 'label' => 'Run '.$run->id, 'status' => $run->status,
                'origin_location_id' => $run->originLocation?->uuid, 'destination_location_id' => $run->destinationLocation?->uuid,
                'vehicle_id' => $run->vehicle?->uuid,
            ]),
        ]);
    }

    private function location($driver, ?string $uuid): ?Location
    {
        if (!$uuid) return null;
        $saved = Location::where('uuid', $uuid)->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->first();
        if ($saved) return $saved;
        $candidate = Cache::get("driver-trip-location:{$driver->id}:$uuid");
        abort_unless($candidate, 422, 'This location selection expired. Search and select it again.');
        return new Location($candidate);
    }

    public function searchLocations(Request $request)
    {
        $driver = $this->driver($request);
        $data = $request->validate(['query' => ['required', 'string', 'min:3', 'max:255']]);
        $saved = Location::where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->where(fn ($q) => $q->where('name', 'like', '%'.$data['query'].'%')->orWhere('full_address', 'like', '%'.$data['query'].'%')->orWhere('address_line_1', 'like', '%'.$data['query'].'%'))->whereNotNull('latitude')->whereNotNull('longitude')->limit(20)->get();
        if ($saved->isNotEmpty()) return ApiResponse::success($saved->map(fn ($l) => $l->toAddressArray()));
        $key = config('services.google_maps.geocoding_api_key');
        abort_unless($key, 503, 'Address search is not configured. Choose a saved location or contact dispatch.');
        $response = Http::timeout(15)->get('https://maps.googleapis.com/maps/api/geocode/json', ['address' => $data['query'], 'key' => $key]);
        abort_unless($response->successful() && in_array($response->json('status'), ['OK', 'ZERO_RESULTS']), 503, 'Address search is unavailable. Please retry.');
        $results = collect($response->json('results', []))->filter(fn ($r) => empty($r['partial_match']) && isset($r['geometry']['location']['lat'], $r['geometry']['location']['lng']))->take(5)->map(function ($r) use ($driver) {
            $component = fn ($type) => collect($r['address_components'])->first(fn ($c) => in_array($type, $c['types']))['long_name'] ?? null;
            $uuid = (string) Str::uuid();
            $location = ['uuid' => $uuid, 'account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id,
                'name' => $r['formatted_address'], 'full_address' => $r['formatted_address'], 'google_place_id' => $r['place_id'],
                'address_line_1' => trim(($component('street_number') ?? '').' '.($component('route') ?? '')),
                'city' => $component('locality') ?? $component('postal_town'), 'province' => $component('administrative_area_level_1'),
                'post_code' => $component('postal_code'), 'country' => $component('country'),
                'latitude' => $r['geometry']['location']['lat'], 'longitude' => $r['geometry']['location']['lng']];
            Cache::put("driver-trip-location:{$driver->id}:$uuid", $location, now()->addHours(2));
            return (new Location($location))->toAddressArray();
        })->values();
        return ApiResponse::success($results);
    }

    public function preview(Request $request, string $id, DriverImportReviewService $review)
    {
        $this->owned($request, $id);
        $data = $request->validate(['run_id' => ['nullable', 'uuid'], 'create_new_run' => ['sometimes', 'boolean'], 'origin_location_id' => ['nullable', 'uuid'], 'destination_location_id' => ['nullable', 'uuid'], 'line_items' => ['required', 'array', 'max:100'], 'pickup_address' => ['nullable', 'array'], 'dropoff_address' => ['nullable', 'array']]);
        $driver = $this->driver($request);
        $run = empty($data['run_id']) || !empty($data['create_new_run']) ? null : $this->runs($driver)->where('uuid', $data['run_id'])->firstOrFail();
        return ApiResponse::success($review->review($driver, $run, $data, $this->location($driver, $data['origin_location_id'] ?? null)));
    }

    public function chooseFinalDestination(Request $request, string $run_uuid)
    {
        $driver = $this->driver($request);
        $data = $request->validate(['destination_location_id' => ['required', 'uuid']]);
        return DB::transaction(function () use ($driver, $data, $run_uuid) {
            $run = $this->runs($driver)->where('uuid', $run_uuid)->lockForUpdate()->firstOrFail();
            $location = $this->location($driver, $data['destination_location_id']);
            abort_unless(is_numeric($location->latitude) && is_numeric($location->longitude)
                && abs((float) $location->latitude) <= 90 && abs((float) $location->longitude) <= 180, 422, 'Choose a location with a valid map position.');
            abort_unless(!$location->environment_id || (int) $location->environment_id === (int) $run->environment_id, 422, 'Choose a location in this run environment.');
            // A stale empty-state screen must not replace a destination saved by dispatch.
            if ($run->destination_location_id) {
                abort_unless($location->exists && $run->destination_location_id === $location->id, 409, 'A final destination has already been set. Refresh the dashboard.');
            } else {
                if (!$location->exists) $location->save();
                $run->update(['destination_location_id' => $location->id]);
            }
            return ApiResponse::success(['run_id' => $run->uuid, 'destination_location_id' => $location->uuid]);
        });
    }

    public function start(Request $request, string $run_uuid, RunService $runs)
    {
        $driver = $this->driver($request);
        $run = $this->runs($driver)->where('uuid', $run_uuid)->firstOrFail();
        return DB::transaction(function () use ($run, $runs) {
            $run = Run::whereKey($run->id)->lockForUpdate()->firstOrFail();
            abort_unless($run->vehicle_id, 422, 'Ask dispatch to assign a vehicle before starting.');
            if ($run->status !== Run::STATUS_IN_PROGRESS) $runs->startRun($run);
            return ApiResponse::success(['run_id' => $run->uuid, 'status' => Run::STATUS_IN_PROGRESS]);
        });
    }

    public function store(Request $request, DeliveryNoteImportService $service)
    {
        $driver = $this->driver($request);
        $data = $request->validate(['file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:20480'], 'run_id' => ['nullable', 'uuid']]);
        $run = empty($data['run_id']) ? null : $this->runs($driver)->where('uuid', $data['run_id'])->firstOrFail();
        $import = $service->analyzeDocument($request->user(), $data['file'], $driver->merchant, $run);

        return ApiResponse::success($this->payload($import), [], 201);
    }

    public function show(Request $request, string $id)
    {
        return ApiResponse::success($this->payload($this->owned($request, $id)));
    }

    private function payload(DeliveryNoteImport $import): array
    {
        $refs = collect($import->extracted_data['line_items'] ?? [])->pluck('merchant_order_ref')
            ->push($import->extracted_data['merchant_order_ref'] ?? null)->filter();

        return [
            'import_id' => $import->uuid, 'status' => $import->status, 'filename' => $import->original_name,
            'run_id' => $import->run?->uuid, 'extracted_data' => $import->extracted_data,
            'confirmation_result' => $import->confirmation_result,
            'existing_references' => Shipment::withTrashed()->where('merchant_id', $import->merchant_id)
                ->whereIn('merchant_order_ref', $refs)->pluck('merchant_order_ref')->all(),
        ];
    }

    public function confirm(ConfirmDriverDocumentImportRequest $request, string $id, ShipmentService $shipments, RunService $runs)
    {
        $owned = $this->owned($request, $id);
        $driver = $this->driver($request);
        $data = $request->validated();
        ksort($data['line_items'], SORT_NUMERIC);
        $result = DB::transaction(function () use ($owned, $driver, $data, $shipments, $runs) {
            \App\Models\Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $import = DeliveryNoteImport::whereKey($owned->id)->lockForUpdate()->firstOrFail();
            if ($import->status === 'confirmed') {
                return $import->confirmation_result;
            }
            abort_unless($import->status === 'analyzed', 409, 'This document has not been successfully analyzed.');
            // Run confirmation happens after extraction; never trust an arbitrary run UUID.
            if (array_key_exists('run_id', $data)) {
                $run = $data['run_id'] ? $this->runs($driver)->where('uuid', $data['run_id'])->lockForUpdate()->first() : null;
                abort_if($data['run_id'] && ! $run, 409, 'The selected run is no longer assigned or active. Choose a current run.');
                $import->run_id = $run?->id;
                $import->environment_id = $run?->environment_id;
            } else {
                $run = $import->run_id ? $this->runs($driver)->whereKey($import->run_id)->lockForUpdate()->first() : null;
                abort_if($import->run_id && ! $run, 409, 'The selected run is no longer assigned or active. Choose a current run.');
            }
            $origin = $this->location($driver, $data['origin_location_id'] ?? null);
            $end = $this->location($driver, $data['destination_location_id'] ?? null);
            foreach ([$origin, $end] as $location) {
                if ($location && (!is_numeric($location->latitude) || !is_numeric($location->longitude))) {
                    throw ValidationException::withMessages(['origin_location_id' => 'Choose locations with a confirmed map position.']);
                }
            }
            $newRun = !empty($data['create_new_run']);
            if ($newRun) $run = null;
            $previewData = array_intersect_key($data, array_flip(['run_id', 'create_new_run', 'origin_location_id', 'destination_location_id', 'line_items', 'pickup_address', 'dropoff_address']));
            $review = app(DriverImportReviewService::class)->review($driver, $run, $previewData, $origin);
            if (!empty($data['review_token']) && !hash_equals($review['review_token'], $data['review_token'])) {
                abort(409, 'The run or stop matches changed. Review the shipments again before confirming.');
            }
            $eligible = collect($data['line_items'])->filter(fn ($item) => empty($item['excluded']) && !Shipment::withTrashed()->where('merchant_id', $driver->merchant_id)->where('merchant_order_ref', ($item['merchant_order_ref'] ?? ''))->exists());
            if ($newRun) {
                abort_if($eligible->isEmpty(), 422, 'No new shipments to assign. An empty run will not be created.');
                $vehicle = $driver->vehicles()->where('vehicles.account_id', $driver->account_id)->where('vehicles.merchant_id', $driver->merchant_id)->where('vehicles.uuid', $data['vehicle_id'] ?? '')->first();
                abort_unless($vehicle, 422, 'Choose your assigned vehicle, or ask dispatch to assign one.');
                $run = $runs->createRun(['merchant_id' => $driver->merchant->uuid, 'driver_id' => $driver->uuid, 'vehicle_id' => $vehicle->uuid]);
            }
            foreach ([$origin, $end] as $location) {
                if ($location && !$location->exists) {
                    $location->save();
                }
            }
            if ($run && $origin && $end) {
                foreach ([$origin, $end] as $location) abort_unless((!$location->environment_id || (int) $location->environment_id === (int) $run->environment_id), 422, 'Locations must belong to the selected run environment.');
                // Explicitly reviewed planned endpoints never rewrite historical visit events.
                $run->update(['origin_location_id' => $origin->id, 'destination_location_id' => $end->id, 'driver_workflow' => true]);
                $import->run_id = $run->id;
                $import->environment_id = $run->environment_id;
            }
            $timezone = $driver->merchant->timezone ?: config('app.timezone');
            $today = now($timezone)->toDateString();
            $rows = $data['grouping_mode'] === 'single_shipment'
                ? [['merchant_order_ref' => $data['merchant_order_ref'], 'collection_date' => $data['collection_date'], 'items' => $data['line_items']]]
                : array_map(fn ($item, $index) => ['merchant_order_ref' => $item['merchant_order_ref'] ?? '', 'collection_date' => $item['collection_date'] ?? $data['collection_date'], 'items' => [$item], 'index' => $index], $data['line_items'], array_keys($data['line_items']));
            if (collect($rows)->filter(fn ($row) => empty($row['items'][0]['excluded']))->pluck('merchant_order_ref')->duplicates()->isNotEmpty()) {
                throw ValidationException::withMessages(['line_items' => ['Use a unique reference for each shipment, or group the items into one shipment.']]);
            }
            if (collect($data['line_items'])->sum(fn ($item) => $item['quantity'] ?? 1) > 500) {
                throw ValidationException::withMessages(['line_items' => ['Import at most 500 parcels at a time.']]);
            }
            $result = ['created' => [], 'skipped' => [], 'attached' => [], 'unassigned' => [], 'delivered' => [], 'run_id' => $run?->uuid];
            $createdIds = [];
            foreach ($rows as $row) {
                $ref = $row['merchant_order_ref'];
                $item = $row['items'][0];
                if (!empty($item['excluded'])) { $result['skipped'][] = $ref; continue; }
                if (Shipment::withTrashed()->where('merchant_id', $driver->merchant_id)->where('merchant_order_ref', $ref)->exists()) {
                    $result['skipped'][] = $ref;

                    continue;
                }
                foreach (['pickup_address', 'dropoff_address'] as $kind) {
                    $address = $item[$kind] ?? $data[$kind];
                    foreach (['address_line_1', 'city', 'province', 'post_code'] as $field) {
                        if (trim($address[$field] ?? '') === '') throw ValidationException::withMessages(['line_items' => "$ref: complete the $kind $field."]);
                    }
                }
                $parcels = [];
                foreach ($row['items'] as $item) {
                    $parcel = array_filter([
                        'type' => $item['type'] ?? null, 'contents_description' => $item['description'],
                        'weight' => $item['weight'] ?? null, 'weight_measurement' => 'kg',
                        'length_cm' => $item['length_cm'] ?? null, 'width_cm' => $item['width_cm'] ?? null, 'height_cm' => $item['height_cm'] ?? null,
                    ], fn ($value) => $value !== null && $value !== '');
                    for ($i = 0; $i < ($item['quantity'] ?? 1); $i++) {
                        $parcels[] = $parcel;
                    }
                }
                $created = $shipments->createShipment([
                    'merchant_id' => $driver->merchant->uuid, 'environment_id' => $run?->environment?->uuid,
                    'merchant_order_ref' => $ref, 'collection_date' => CarbonImmutable::parse($row['collection_date'], $timezone)->startOfDay()->utc(),
                    'pickup_address' => $item['pickup_address'] ?? $data['pickup_address'], 'dropoff_address' => $item['dropoff_address'] ?? $data['dropoff_address'],
                    'delivery_note_number' => $data['delivery_note_number'] ?? null,
                    'pickup_instructions' => $data['pickup_instructions'] ?? null, 'dropoff_instructions' => $data['dropoff_instructions'] ?? null,
                    'auto_assign' => false, 'parcels' => $parcels, 'metadata' => ['delivery_note_import_id' => $import->uuid],
                ]);
                if (! $created['created']) {
                    $result['skipped'][] = $ref;

                    continue;
                }
                $shipment = $created['shipment'];
                $createdIds[] = $shipment->id;
                $result['created'][] = $ref;
                if ($run) {
                    $runs->attachShipments($run, [$shipment->uuid], allowInProgress: true);
                    $result['attached'][] = $ref;
                    $state = $review['rows'][$row['index'] ?? 0];
                    $status = $state['status'];
                    $booking = app(InternalBookingLifecycleService::class)->ensureBookingForShipment($shipment, $run);
                    $previousStatus = $booking->status;
                    $stop = $state['matched_stop'] ? VehicleActivity::where('uuid', $state['matched_stop']['stop_id'])->where('run_id', $run->id)->first() : null;
                    if ($state['status_source'] === 'driver' && $booking->odometer_at_collection === null && !isset($item['odometer_at_collection'])) throw ValidationException::withMessages(['line_items' => 'Enter the pickup odometer for driver status updates.']);
                    if (isset($item['odometer_at_delivery']) && $item['odometer_at_delivery'] < ($item['odometer_at_collection'] ?? $booking->odometer_at_collection ?? 0)) throw ValidationException::withMessages(['line_items' => 'Delivery odometer cannot be lower than pickup odometer.']);
                    if ($status === 'delivered' && $state['status_source'] === 'driver' && $booking->odometer_at_delivery === null && !isset($item['odometer_at_delivery'])) {
                        throw ValidationException::withMessages(['line_items' => 'Enter the delivery odometer for manually delivered shipments.']);
                    }
                    if ($status === 'failed' && trim($item['failure_reason'] ?? '') === '') throw ValidationException::withMessages(['line_items' => 'Enter a failure reason.']);
                    if (in_array($status, ['delivered', 'in_transit', 'failed'], true)) {
                        $booking->update(['status' => $status, 'delivered_at' => $status === 'delivered' ? ($stop?->occurred_at ?? now()) : null,
                            'odometer_at_delivery' => $item['odometer_at_delivery'] ?? $booking->odometer_at_delivery,
                            'odometer_at_collection' => $item['odometer_at_collection'] ?? $booking->odometer_at_collection]);
                        $shipment->update(['status' => $status, 'metadata' => array_merge($shipment->metadata ?? [], ['matched_stop_id' => $stop?->uuid, 'status_source' => $state['status_source']])]);
                        TrackingEvent::create(['account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id, 'shipment_id' => $shipment->id, 'booking_id' => $booking->id,
                            'event_code' => $status, 'event_description' => $status === 'failed' ? trim($item['failure_reason']) : 'Status confirmed during delivery note import.',
                            'occurred_at' => $stop?->occurred_at ?? now(), 'payload' => ['source' => $state['status_source'], 'actor_id' => $driver->user_id, 'matched_stop_id' => $stop?->uuid, 'import_id' => $import->uuid, 'previous_status' => $previousStatus]]);
                        if ($status === 'delivered') $result['delivered'][] = $ref;
                    }
                } else {
                    $result['unassigned'][] = $ref;
                }
            }
            abort_if($newRun && !$createdIds, 409, 'These shipments already exist. No empty run was created.');
            $import->shipments()->sync($createdIds);
            $import->update(['status' => 'confirmed', 'confirmed_at' => now(), 'reviewed_data' => $data, 'confirmation_result' => $result]);

            return $result;
        });

        return ApiResponse::success($result);
    }
}
