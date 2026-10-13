<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\RunResource;
use App\Models\DeliveryNoteImport;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\Shipment;
use App\Services\DeliveryNoteQuantity;
use App\Services\RunService;
use App\Services\ShipmentService;
use App\Support\ApiResponse;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/** Admin-only new-run import. Reading and preview never create operational records. */
class AdminRunImportController extends Controller
{
    private function owned(Request $request, string $id): DeliveryNoteImport
    {
        abort_unless($request->user() && in_array($request->user()->role, ['user', 'super_admin'], true), 403);
        $merchant = $request->attributes->get('merchant');
        if (!$merchant) {
            $merchant = Merchant::where('uuid', $request->input('merchant_id'))->firstOrFail();
        }
        $this->authorize('create', [Run::class, $merchant]);
        $this->authorize('create', [Shipment::class, $merchant]);
        $environment = $request->attributes->get('merchant_environment');
        $environmentUuid = $environment?->uuid ?? $request->input('environment_id');
        $environmentId = $environmentUuid ? $merchant->environments()->where('uuid', $environmentUuid)->firstOrFail()->id : null;
        return DeliveryNoteImport::where('uuid', $id)->where('merchant_id', $merchant->id)
            ->where('account_id', $merchant->account_id)->where('environment_id', $environmentId)->firstOrFail();
    }

    private function data(Request $request): array
    {
        // Excluded extraction rows may be malformed; only their reference is relevant.
        $items = $request->input('line_items');
        if (is_array($items)) $request->merge(['line_items' => array_map(fn ($item) => is_array($item) && !empty($item['excluded'])
            ? array_intersect_key($item, array_flip(['merchant_order_ref', 'excluded'])) : $item, $items)]);
        return $request->validate([
            'origin_location_id' => ['nullable', 'uuid'], 'destination_location_id' => ['nullable', 'uuid'],
            'driver_id' => ['nullable', 'uuid'], 'vehicle_id' => ['nullable', 'uuid'],
            'planned_start_at' => ['nullable', 'date'], 'service_area' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string'], 'delivery_note_number' => ['nullable', 'string', 'max:120'],
            'line_items' => ['required', 'array', 'min:1', 'max:100'], 'line_items.*' => ['array'],
            'line_items.*.merchant_order_ref' => ['nullable', 'string', 'max:255'],
            'line_items.*.description' => ['nullable', 'string', 'max:255'],
            'line_items.*.quantity' => ['nullable', 'numeric'],
            'line_items.*.quantity_unit' => ['nullable', 'in:'.implode(',', DeliveryNoteQuantity::UNITS)],
            'line_items.*.collection_date' => ['nullable', 'date_format:Y-m-d'],
            'line_items.*.pickup_location_id' => ['nullable', 'uuid'], 'line_items.*.dropoff_location_id' => ['nullable', 'uuid'],
            'line_items.*.excluded' => ['sometimes', 'boolean'],
            'line_items.*.pickup_instructions' => ['nullable', 'string'], 'line_items.*.dropoff_instructions' => ['nullable', 'string'],
            'line_items.*.weight' => ['nullable', 'numeric', 'min:0.01'],
            'line_items.*.length_cm' => ['nullable', 'numeric', 'min:0.01'],
            'line_items.*.width_cm' => ['nullable', 'numeric', 'min:0.01'], 'line_items.*.height_cm' => ['nullable', 'numeric', 'min:0.01'],
        ]);
    }

    private function location(DeliveryNoteImport $import, ?string $id): ?Location
    {
        if (!$id) return null;
        return Location::where('uuid', $id)->where('account_id', $import->account_id)->where('merchant_id', $import->merchant_id)
            ->where(fn ($q) => $q->whereNull('environment_id')->orWhere('environment_id', $import->environment_id))->first();
    }

    private function review(DeliveryNoteImport $import, array $data): array
    {
        $origin = $this->location($import, $data['origin_location_id'] ?? null);
        $end = $this->location($import, $data['destination_location_id'] ?? null);
        $tripWarnings = [];
        foreach (['starting point' => $origin, 'planned end location' => $end] as $label => $location) {
            if (!$location || !is_numeric($location->latitude) || !is_numeric($location->longitude)) $tripWarnings[] = "Choose a $label with a confirmed map position.";
        }
        $rows = [];
        $refs = collect($data['line_items'])->filter(fn ($item) => empty($item['excluded']))->pluck('merchant_order_ref')->map(fn ($ref) => trim((string) $ref));
        foreach ($data['line_items'] as $index => $item) {
            $reference = trim($item['merchant_order_ref'] ?? '');
            $existing = $reference && Shipment::withTrashed()->where('account_id', $import->account_id)->where('merchant_id', $import->merchant_id)->where('merchant_order_ref', $reference)->exists();
            $eligibility = !empty($item['excluded']) ? 'excluded' : ($existing ? 'existing' : 'new');
            $warnings = [];
            $pickup = $this->location($import, $item['pickup_location_id'] ?? null);
            $dropoff = $this->location($import, $item['dropoff_location_id'] ?? null);
            if ($eligibility === 'new') {
                if (!$reference) $warnings[] = 'Shipment reference is missing.';
                if ($reference && $refs->filter(fn ($ref) => $ref === $reference)->count() > 1) $warnings[] = 'Use a unique shipment reference.';
                if (trim($item['description'] ?? '') === '') $warnings[] = 'Description is missing.';
                if (empty($item['collection_date'])) $warnings[] = 'Choose a collection date.';
                if (!$pickup) $warnings[] = 'Choose a collection location.';
                if (!$dropoff) $warnings[] = 'Choose a delivery location.';
                $measured = in_array($item['quantity_unit'] ?? 'units', DeliveryNoteQuantity::MEASURED, true);
                $quantityRules = $measured ? ['required', 'numeric', 'gt:0', ($item['quantity_unit'] === 'tonnes' ? 'max:9999.999' : 'max:1000000')] : ['required', 'integer', 'min:1', 'max:100'];
                if (Validator::make($item, ['quantity' => $quantityRules])->fails()) $warnings[] = $measured ? 'Enter a valid positive measured quantity.' : 'Enter a whole quantity between 1 and 100.';
            }
            $rows[] = ['index' => $index, 'reference' => $reference, 'eligibility' => $eligibility, 'validation_warnings' => $warnings,
                'collection_comparison' => $pickup && $origin ? ($pickup->id === $origin->id ? 'match' : 'mismatch') : 'unknown'];
        }
        $eligible = collect($rows)->where('eligibility', 'new');
        $parcelCount = $eligible->sum(function ($row) use ($data) {
            $item = $data['line_items'][$row['index']];
            return in_array($item['quantity_unit'] ?? 'units', DeliveryNoteQuantity::MEASURED, true) ? 1 : max(0, (int) ($item['quantity'] ?? 0));
        });
        if ($parcelCount > 500) $tripWarnings[] = 'An import can contain at most 500 parcels.';
        if ($eligible->isEmpty()) $tripWarnings[] = 'Include at least one new shipment to create a run.';
        return ['rows' => $rows, 'warnings' => $tripWarnings, 'can_confirm' => !$tripWarnings && $eligible->every(fn ($row) => !$row['validation_warnings'])];
    }

    public function preview(Request $request, string $id)
    {
        $import = $this->owned($request, $id);
        abort_unless($import->status === 'analyzed' && !$import->run_id, 409, 'Choose an analyzed document that is not attached to a run.');
        return ApiResponse::success($this->review($import, $this->data($request)));
    }

    public function confirm(Request $request, string $id, RunService $runs, ShipmentService $shipments)
    {
        $owned = $this->owned($request, $id);
        $data = $this->data($request);
        $result = DB::transaction(function () use ($owned, $data, $runs, $shipments) {
            // Match RunService lock order; serialize reference checks with run creation.
            Merchant::whereKey($owned->merchant_id)->lockForUpdate()->firstOrFail();
            $import = DeliveryNoteImport::whereKey($owned->id)->lockForUpdate()->firstOrFail();
            if ($import->status === 'confirmed' && ($import->confirmation_result['source'] ?? null) === 'admin_create_run') {
                return [...$import->confirmation_result, 'already_confirmed' => true];
            }
            abort_unless($import->status === 'analyzed' && !$import->run_id, 409, 'This document cannot create a new run.');
            $review = $this->review($import, $data);
            if (!$review['can_confirm']) throw ValidationException::withMessages(['line_items' => array_merge($review['warnings'], ...array_column($review['rows'], 'validation_warnings'))]);
            $merchant = $import->merchant;
            $environment = $import->environment_id ? $merchant->environments()->findOrFail($import->environment_id) : null;
            foreach (['driver_id' => \App\Models\Driver::class, 'vehicle_id' => \App\Models\Vehicle::class] as $key => $model) {
                if (!empty($data[$key]) && !$model::where('uuid', $data[$key])->where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)->exists()) {
                    throw ValidationException::withMessages([$key => 'Choose a resource belonging to this merchant.']);
                }
            }
            $run = $runs->createRun([
                'merchant_id' => $merchant->uuid, 'environment_id' => $environment?->uuid,
                ...array_intersect_key($data, array_flip(['origin_location_id', 'destination_location_id', 'driver_id', 'vehicle_id', 'planned_start_at', 'service_area', 'notes'])),
            ], $environment);
            $ids = []; $uuids = []; $skipped = [];
            foreach ($review['rows'] as $row) {
                if ($row['eligibility'] !== 'new') { $skipped[] = $row['reference']; continue; }
                $item = $data['line_items'][$row['index']];
                $created = $shipments->createShipment([
                    'merchant_id' => $merchant->uuid, 'environment_id' => $environment?->uuid,
                    'merchant_order_ref' => $row['reference'], 'delivery_note_number' => $data['delivery_note_number'] ?? null,
                    'collection_date' => CarbonImmutable::parse($item['collection_date'], $merchant->timezone ?: config('app.timezone'))->startOfDay()->utc(),
                    'pickup_location_id' => $item['pickup_location_id'], 'dropoff_location_id' => $item['dropoff_location_id'],
                    'pickup_instructions' => $item['pickup_instructions'] ?? null, 'dropoff_instructions' => $item['dropoff_instructions'] ?? null,
                    'auto_assign' => false, 'parcels' => DeliveryNoteQuantity::parcels($item),
                    'metadata' => ['delivery_note_import_id' => $import->uuid, 'delivery_note_items' => [['reference' => $row['reference'], 'quantity' => $item['quantity'], 'quantity_unit' => $item['quantity_unit'] ?? 'units']]],
                ]);
                abort_unless($created['created'], 409, 'Shipment references changed. Review the document again.');
                $ids[] = $created['shipment']->id; $uuids[] = $created['shipment']->uuid;
            }
            $runs->attachShipments($run, $uuids);
            $result = ['source' => 'admin_create_run', 'run_id' => $run->uuid, 'shipment_ids' => $uuids, 'skipped' => $skipped, 'already_confirmed' => false];
            $import->shipments()->sync($ids);
            $import->update(['run_id' => $run->id, 'status' => 'confirmed', 'confirmed_at' => now(), 'reviewed_data' => $data, 'confirmation_result' => $result]);
            return $result;
        });
        return ApiResponse::success([...$result, 'run' => new RunResource($runs->getRunForUser($request->user(), $result['run_id']))]);
    }
}
