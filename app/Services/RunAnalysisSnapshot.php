<?php

namespace App\Services;

use App\Models\Location;
use App\Models\LocationType;
use App\Models\Run;
use App\Models\RunEndRequest;
use App\Models\RunShipment;
use App\Models\VehicleLocationHistory;
use App\Support\GeofencePolygon;
use App\Support\RunActivityQuery;
use Illuminate\Support\Facades\DB;

class RunAnalysisSnapshot
{
    public function cachedFingerprint(Run $run): string
    {
        return \Illuminate\Support\Facades\Cache::remember('run-analysis-fingerprint:'.$run->uuid, 30, fn () => $this->fingerprint($run));
    }

    public function fingerprint(Run $run): string
    {
        $run->refresh()->load('merchant');
        $digest = hash_init('sha256');
        hash_update($digest, json_encode([$run->getRawOriginal(), $run->merchant->location_automation_settings, $run->merchant->allow_auto_shipment_creations_at_locations, config('vehicle_history.display_enabled')], JSON_THROW_ON_ERROR));
        $queries = [
            $this->locationQuery($run),
            LocationType::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->orderBy('id'),
            RunActivityQuery::forRuns([$run->id])->select('vehicle_activity.*')->orderBy('vehicle_activity.id'),
            VehicleLocationHistory::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('run_id', $run->id)->orderBy('id'),
            RunShipment::where('run_id', $run->id)->orderBy('id'),
            \App\Models\Shipment::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('environment_id', $run->environment_id)->whereHas('runShipments', fn ($q) => $q->where('run_id', $run->id))->orderBy('id'),
            RunEndRequest::where('run_id', $run->id)->orderBy('id'),
        ];
        foreach ($queries as $query) {
            foreach ($query->cursor() as $row) {
                $attributes = $row->getAttributes();
                // Spatial binary is represented by the readable WKT alias instead.
                if (array_key_exists('polygon_wkt', $attributes)) {
                    unset($attributes['polygon_bounds']);
                }
                hash_update($digest, json_encode($attributes, JSON_THROW_ON_ERROR | JSON_INVALID_UTF8_SUBSTITUTE));
            }
        }

        return hash_final($digest);
    }

    private function locationQuery(Run $run)
    {
        $q = Location::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->where('environment_id', $run->environment_id)->orderBy('id');
        if (in_array(DB::connection()->getDriverName(), ['mysql', 'pgsql'])) {
            $q->select('locations.*')->selectRaw('ST_AsText(polygon_bounds) as polygon_wkt');
        } else {
            $q->select('locations.*')->selectRaw('polygon_bounds as polygon_wkt');
        }

        return $q;
    }

    public function locations(Run $run)
    {
        return $this->locationQuery($run)->with('locationType')->get();
    }

    public function matchLocation($locations, float $lat, float $lng): ?Location
    {
        foreach ($locations as $location) {
            $polygon = GeofencePolygon::fromWkt($location->polygon_wkt);
            if ($polygon?->contains($lat, $lng)) {
                return $location;
            }
            // A nearby saved point is a candidate to fix, never proof of a missing location.
            if ($location->latitude !== null && $location->longitude !== null) {
                $a = deg2rad($lat - (float) $location->latitude);
                $b = deg2rad($lng - (float) $location->longitude);
                $distance = 6371000 * 2 * asin(min(1, sqrt(sin($a / 2) ** 2 + cos(deg2rad($lat)) * cos(deg2rad((float) $location->latitude)) * sin($b / 2) ** 2)));
                if ($distance <= 100) {
                    return $location;
                }
            }
        }

        return null;
    }

    public function build(Run $run): array
    {
        $fingerprint = $this->fingerprint($run);
        $run->load(['merchant', 'originLocation', 'destinationLocation', 'runShipments.shipment.pickupLocation', 'runShipments.shipment.dropoffLocation', 'environment']);
        $cutoff = now();
        $query = RunActivityQuery::forRuns([$run->id])->where('vehicle_activity.occurred_at', '<=', $cutoff)
            ->whereIn('vehicle_activity.event_type', ['stopped', 'entered_location', 'exited_location', 'shipment_collection', 'shipment_delivery', 'run_started', 'run_ended', 'shipment_created', 'shipment_ended']);
        $count = (clone $query)->count();
        $events = (clone $query)->select('vehicle_activity.*')->orderBy('vehicle_activity.occurred_at')->orderBy('vehicle_activity.id')->limit(750)->get();
        if ($count > 750) {
            $events = $events->concat((clone $query)->select('vehicle_activity.*')->orderByDesc('vehicle_activity.occurred_at')->orderByDesc('vehicle_activity.id')->limit(750)->get())->unique('id')->sortBy('occurred_at')->values();
        }
        $locations = $this->locations($run);
        $relevant = collect([$run->origin_location_id, $run->destination_location_id])->merge($events->pluck('location_id'));
        $candidates = [];
        $facts = [];
        foreach ($events as $event) {
            $arrival = $event->entered_at;
            $windowEnd = $run->completed_at ?? $cutoff;
            if ($arrival && $run->started_at && $arrival < $run->started_at) {
                $arrival = $run->started_at;
            }
            $departure = $event->exited_at && $event->exited_at < $windowEnd ? $event->exited_at : $windowEnd;
            $seconds = $arrival && $event->exited_at && $departure >= $arrival ? $arrival->diffInSeconds($departure) : null;
            $openElapsed = $arrival && ! $event->exited_at && $windowEnd >= $arrival ? $arrival->diffInSeconds($windowEnd) : null;
            $location = $locations->firstWhere('id', $event->location_id);
            $validCoordinate = is_numeric($event->latitude) && is_numeric($event->longitude) && abs((float) $event->latitude) <= 90 && abs((float) $event->longitude) <= 180;
            $match = $validCoordinate ? $this->matchLocation($locations, (float) $event->latitude, (float) $event->longitude) : null;
            if ($match) {
                $relevant->push($match->id);
            }
            if (! $event->location_id && $event->event_type === 'stopped' && $validCoordinate && ! $match) {
                $candidates[] = ['candidate_id' => $event->uuid, 'latitude' => (float) $event->latitude, 'longitude' => (float) $event->longitude, 'occurred_at' => $event->occurred_at?->toIso8601String(), 'duration_seconds' => $seconds];
            }
            $facts[] = ['evidence_id' => $event->uuid, 'event' => $event->event_type, 'at' => $event->occurred_at?->toIso8601String(), 'entered_at' => $event->entered_at?->toIso8601String(), 'exited_at' => $event->exited_at?->toIso8601String(), 'duration_seconds' => $seconds, 'open_visit_elapsed_seconds' => $openElapsed, 'open_visit_is_not_proof_of_current_presence' => true,
                'location_id' => $location?->uuid, 'nearby_saved_location_id' => $match?->uuid, 'latitude' => $validCoordinate ? (float) $event->latitude : null, 'longitude' => $validCoordinate ? (float) $event->longitude : null,
                'expected_waiting_minutes' => $location?->expected_waiting_time,
                'exceeded_wait_seconds' => $seconds !== null && $location?->expected_waiting_time !== null ? max(0, $seconds - $location->expected_waiting_time * 60) : null,
                'execution' => array_intersect_key($event->metadata ?? [], array_flip(['reason', 'automation_action', 'automation', 'exit_reason']))];
        }
        $shipments = $run->runShipments->map(function ($assignment) use ($run, &$relevant) {
            $shipment = $assignment->shipment;
            if (! $shipment || $shipment->merchant_id !== $run->merchant_id || $shipment->account_id !== $run->account_id || $shipment->environment_id !== $run->environment_id) {
                return null;
            }
            $relevant = $relevant->merge([$shipment->pickup_location_id, $shipment->dropoff_location_id]);

            return ['assignment_id' => $assignment->uuid, 'status' => $shipment->status, 'assignment_status' => $assignment->status, 'sequence' => $assignment->sequence, 'reference' => $shipment->merchant_order_ref,
                'pickup_location_id' => $shipment->pickupLocation?->uuid, 'dropoff_location_id' => $shipment->dropoffLocation?->uuid, 'collection_date' => $shipment->collection_date, 'delivery_date' => $shipment->delivery_date];
        })->filter()->values()->all();
        $types = LocationType::where('account_id', $run->account_id)->where('merchant_id', $run->merchant_id)->orderBy('id')->get()->map(fn ($type) => [
            'location_type_id' => $type->uuid, 'title' => $type->title, 'slug' => $type->slug, 'collection_point' => $type->collection_point, 'delivery_point' => $type->delivery_point,
            'effective_rules_now' => app(AutoRunLifecycleService::class)->describeLocationAutomation($run->merchant, $type),
        ])->all();
        $track = app(RunTrackService::class)->get($run);
        $snapshot = [
            'schema_version' => 'run-analysis-v1', 'fingerprint' => $fingerprint, 'as_of' => $cutoff->toIso8601String(), 'timezone' => $run->merchant->timezone ?: config('app.timezone'),
            'run' => ['run_id' => $run->uuid, 'reference' => 'Run '.$run->id, 'status' => $run->status, 'driver_workflow' => $run->driver_workflow, 'schedule_managed' => $run->schedule_managed, 'auto_created' => $run->auto_created, 'planning_notes' => mb_substr((string) $run->notes, 0, 8000),
                'planned_start_at' => $run->planned_start_at?->toIso8601String(), 'started_at' => $run->started_at?->toIso8601String(), 'completed_at' => $run->completed_at?->toIso8601String(),
                'elapsed_seconds' => $run->started_at ? max(0, $run->started_at->diffInSeconds($run->completed_at ?? $cutoff)) : null,
                'origin_location_id' => $run->originLocation?->uuid, 'destination_location_id_now' => $run->destinationLocation?->uuid],
            'lifecycle_contract' => ['driver_workflow_requires_dispatch_closure' => (bool) $run->driver_workflow, 'shipment_completion_does_not_close_run' => true, 'legacy_collection_entry_can_end_previous_run' => true, 'expected_total_duration' => null, 'current_destination_may_have_been_set_at_closure' => true],
            'automation_now' => ['enabled' => (bool) $run->merchant->allow_auto_shipment_creations_at_locations, 'settings' => $run->merchant->location_automation_settings, 'captured_at' => $cutoff->toIso8601String()],
            'location_types' => $types,
            'locations' => $locations->whereIn('id', $relevant->filter()->unique()->all())->map(fn ($loc) => ['location_id' => $loc->uuid, 'name' => $loc->name, 'address' => $loc->full_address, 'location_type_id' => $loc->locationType?->uuid, 'expected_waiting_minutes' => $loc->expected_waiting_time, 'latitude' => $loc->latitude, 'longitude' => $loc->longitude, 'geofence_wkt' => $loc->polygon_wkt])->values()->all(),
            'shipments' => $shipments, 'events' => $facts, 'missing_location_candidates' => $candidates,
            'end_requests' => RunEndRequest::where('run_id', $run->id)->orderBy('id')->get()->map(fn ($r) => ['status' => $r->status, 'reason' => $r->reason, 'at' => $r->created_at?->toIso8601String(), 'reviewed_at' => $r->reviewed_at?->toIso8601String(), 'review_reason' => $r->review_reason])->all(),
            'gps' => ['status' => $track['status'], 'source' => $track['source'], 'coverage' => $track['coverage'], 'segments' => $track['segments'], 'stationary_intervals' => $track['stops']],
            'coverage' => ['event_count' => $count, 'included_event_count' => count($facts), 'events_truncated' => $count > count($facts), 'historical_settings_snapshot_available' => false, 'missing_location_match_method' => 'known polygon or saved point within 100 metres; missing geometry cannot prove absence', 'saved_locations_without_coordinates_or_polygon' => $locations->filter(fn ($loc) => $loc->latitude === null && $loc->longitude === null && ! $loc->polygon_wkt)->count()],
        ];
        // Hard prompt budget; keep the report honest when GPS/context cannot fit.
        if (strlen(json_encode($snapshot)) > 180000) {
            $snapshot['gps']['segments'] = [];
            $snapshot['coverage']['gps_samples_omitted_for_size'] = true;
        }
        if (strlen(json_encode($snapshot)) > 250000) {
            throw new \RuntimeException('Run context exceeds the analysis limit.');
        }

        return $snapshot;
    }
}
