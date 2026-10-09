<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Location;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\VehicleActivity;

/** Read-only review. Confirmation computes this again under the run/import locks. */
class DriverImportReviewService
{
    public function addressKey(array $address): ?string
    {
        $parts = array_map(fn ($key) => preg_replace('/[^\pL\pN]/u', '', mb_strtolower(trim((string) ($address[$key] ?? '')))), ['address_line_1', 'city', 'province', 'post_code']);
        return in_array('', $parts, true) ? null : implode('|', $parts);
    }

    public function collectionFromRunStart(array $item, ?Location $origin): array
    {
        $address = $item['pickup_address'] ?? [];
        $hasAddress = collect(['full_address', 'address_line_1', 'address_line_2', 'town', 'city', 'province', 'post_code', 'country'])
            ->contains(fn ($key) => is_string($address[$key] ?? null) && trim($address[$key]) !== '');
        if (empty($item['pickup_from_run_start']) && (!empty($item['pickup_location_id']) || $hasAddress)) return $item;
        if (! $origin) return $item;
        $item['pickup_from_run_start'] = true;
        $item['pickup_location_id'] = $origin->exists ? $origin->uuid : null;
        $item['pickup_address'] = array_intersect_key($origin->toAddressArray(), array_flip(['name', 'address_line_1', 'address_line_2', 'town', 'city', 'province', 'post_code', 'country', 'company', 'first_name', 'last_name', 'phone']));
        return $item;
    }

    public function review(Driver $driver, ?Run $run, array $data, ?Location $origin = null): array
    {
        $events = $run ? $run->vehicleActivities()->where('account_id', $driver->account_id)
            ->where('merchant_id', $driver->merchant_id)->where(function ($q) { $q->where('event_type', VehicleActivity::EVENT_SHIPMENT_DELIVERY)->orWhere(fn ($q) => $q->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)->whereNotNull('entered_at')->whereNotNull('exited_at')->whereHas('location.locationType', fn ($t) => $t->where('delivery_point', true))); })
            ->where('occurred_at', '<=', now())->with('location')->get() : collect();
        $rows = [];
        $items = $data['line_items'] ?? [];
        ksort($items, SORT_NUMERIC);
        $locationIds = collect($items)->flatMap(fn ($item) => [$item['pickup_location_id'] ?? null, $item['dropoff_location_id'] ?? null])
            ->push($origin?->exists ? $origin->uuid : null)->filter()->unique();
        $savedLocations = Location::where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)
            ->whereIn('uuid', $locationIds)->get()->keyBy('uuid');
        foreach ($items as $index => $item) {
            $item = $this->collectionFromRunStart($item, $origin);
            if (!empty($item['excluded'])) $item = ['excluded' => true, 'merchant_order_ref' => $item['merchant_order_ref'] ?? null];
            $reference = trim((string) ($item['merchant_order_ref'] ?? ''));
            $existing = $reference ? Shipment::withTrashed()->where('account_id', $driver->account_id)->where('merchant_id', $driver->merchant_id)->where('merchant_order_ref', $reference)->first() : null;
            $pickup = $item['pickup_address'] ?? [];
            $dropoff = $item['dropoff_address'] ?? [];
            $key = $this->addressKey($dropoff);
            $matches = $key ? $events->filter(fn ($event) => $event->location && $this->addressKey($event->location->toAddressArray()) === $key)
                ->unique(fn ($event) => $event->location_id.':'.($event->entered_at ?? $event->occurred_at)->toIso8601String())->values() : collect();
            $match = $matches->count() === 1 ? $matches->first() : null;
            $otherRun = $existing?->currentRunShipment?->run;
            $eligibility = $existing ? ($otherRun && $otherRun->id !== $run?->id ? 'excluded' : 'existing') : (!empty($item['excluded']) ? 'excluded' : 'new');
            $pickupKey = $this->addressKey($pickup);
            $originKey = $origin ? $this->addressKey($origin->toAddressArray()) : null;
            $pickupLocation = $savedLocations->get($item['pickup_location_id'] ?? '');
            $dropoffLocation = $savedLocations->get($item['dropoff_location_id'] ?? '');
            $comparison = $pickupLocation && $origin?->exists
                ? ($pickupLocation->id === $origin->id ? 'match' : 'mismatch')
                : (!$pickupKey || !$originKey ? 'unknown' : ($pickupKey === $originKey ? 'match' : 'mismatch'));
            $rows[] = [
                'index' => $index, 'reference' => $reference, 'eligibility' => $eligibility,
                'validation_warnings' => array_values(array_filter([!$reference ? 'Shipment reference is missing.' : null, empty($item['description']) ? 'Description is missing.' : null, !$pickupLocation && !(!empty($item['pickup_from_run_start']) && $origin) ? 'Choose a collection location.' : null, !$dropoffLocation ? 'Choose a delivery location.' : null])),
                'collection_comparison' => $comparison,
                'status' => $existing?->status ?? ($item['status'] ?? ($match ? 'delivered' : 'booked')),
                'status_source' => !empty($item['status']) ? 'driver' : ($match ? 'matched_visit' : 'initial'),
                'ambiguous_match' => $matches->count() > 1,
                'matched_stop' => $match ? ['stop_id' => $match->uuid, 'location_id' => $match->location->uuid, 'name' => $match->location->name, 'occurred_at' => $match->occurred_at->toIso8601String()] : null,
            ];
        }
        // Canonicalize optional/null fields and object key order across preview and validation.
        $canonical = function ($value) use (&$canonical) {
            if (!is_array($value)) return $value === '' ? null : $value;
            $value = array_map($canonical, $value);
            if (!array_is_list($value)) { $value = array_filter($value, fn ($v) => $v !== null); ksort($value); }
            return $value;
        };
        return ['rows' => $rows, 'review_token' => hash('sha256', json_encode($canonical([$run?->uuid, $run?->updated_at?->toIso8601String(), [$data['origin_location_id'] ?? null, $data['destination_location_id'] ?? null, $data['create_new_run'] ?? null], $rows])))];
    }
}
