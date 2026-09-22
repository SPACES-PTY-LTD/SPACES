<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Support\GeofencePolygon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use RuntimeException;
use Throwable;

class GeofenceShipmentCleanupService
{
    private const GAP_SECONDS = 300;

    private const EVENTS = ['shipment_created', 'shipment_collection', 'shipment_delivery', 'shipment_ended'];

    private array $auditTripEvidence = [];

    public function audit(string $merchantUuid, string $from, string $to, ?string $runUuid = null, ?callable $progress = null): string
    {
        $merchant = Merchant::where('uuid', $merchantUuid)->firstOrFail();
        $start = $this->date($from);
        $end = $this->date($to);
        if ($end <= $start) {
            throw new InvalidArgumentException('The to time must be later than from.');
        }
        $run = $runUuid ? Run::where('merchant_id', $merchant->id)->where('uuid', $runUuid)->firstOrFail() : null;
        $scope = ['merchant' => $merchantUuid, 'from' => $start->toIso8601String(), 'to' => $end->toIso8601String(), 'run' => $runUuid, 'polygon_basis' => 'current', 'maximum_sample_gap_seconds' => self::GAP_SECONDS];
        $batch = $this->batch('audit', $merchant->id, $scope);
        $this->auditTripEvidence = [];
        $processed = 0;
        if ($progress) {
            $progress($batch, $processed);
        }
        try {
            // Select by the immutable creation EVENT, never backdated shipment.created_at.
            Shipment::where('merchant_id', $merchant->id)->where('auto_created', true)
                ->where('metadata->auto_created_from', 'vehicle_location_geofence')
                ->where(function ($q) use ($start, $end, $run) {
                    $q->whereHas('vehicleActivities', function ($events) use ($start, $end, $run) {
                        $events->where('event_type', 'shipment_created')->where('occurred_at', '>=', $start)->where('occurred_at', '<', $end);
                        if ($run) {
                            $events->where('run_id', $run->id);
                        }
                    })->orWhere(function ($missing) use ($start, $end, $run) {
                        // Missing creation evidence is reported, never inferred from shipment.created_at.
                        $missing->whereDoesntHave('vehicleActivities', fn ($events) => $events->where('event_type', 'shipment_created'))
                            ->whereHas('runs', function ($runs) use ($start, $end, $run) {
                                $runs->where('started_at', '<', $end)->where('completed_at', '>=', $start);
                                if ($run) {
                                    $runs->where('runs.id', $run->id);
                                }
                            });
                    });
                })->orderBy('id')->chunkById(100, function ($shipments) use ($batch, $progress, &$processed) {
                    foreach ($shipments as $shipment) {
                        $result = DB::transaction(function () use ($shipment) {
                            $this->lockContext($shipment);

                            return $this->inspect($shipment->id, true);
                        }, 3);
                        DB::table('geofence_cleanup_items')->insert([
                            'batch_uuid' => $batch, 'shipment_uuid' => $shipment->uuid,
                            'classification' => $result['evidence']['classification'], 'status' => 'audited',
                            'evidence' => $this->json($result['evidence']), 'fingerprint' => $this->fingerprint($result['state']),
                            'created_at' => now(), 'updated_at' => now(),
                        ]);
                        $processed++;
                        if ($processed === 1 || $processed % 25 === 0) {
                            if ($progress) {
                                $progress($batch, $processed);
                            }
                        }
                    }
                });
            if ($progress) {
                $progress($batch, $processed);
            }
            DB::table('geofence_cleanup_batches')->where('uuid', $batch)->update(['status' => 'complete', 'updated_at' => now()]);
        } catch (Throwable $e) {
            DB::table('geofence_cleanup_batches')->where('uuid', $batch)->update(['status' => 'failed', 'updated_at' => now()]);
            throw $e;
        } finally {
            $this->auditTripEvidence = [];
        }

        return $batch;
    }

    public function apply(string $auditUuid, array $shipmentUuids, bool $allCandidates = false): string
    {
        if ($allCandidates && $shipmentUuids) {
            throw new InvalidArgumentException('Use either --all-candidates or --shipment, not both.');
        }
        if (! $allCandidates && ! $shipmentUuids) {
            throw new InvalidArgumentException('Select --all-candidates or at least one reviewed --shipment UUID.');
        }
        $audit = DB::table('geofence_cleanup_batches')->where('uuid', $auditUuid)->where('mode', 'audit')->where('status', 'complete')->first();
        if (! $audit) {
            throw new InvalidArgumentException('A completed audit UUID is required.');
        }
        $selected = array_values(array_unique($shipmentUuids));
        $query = DB::table('geofence_cleanup_items')->where('batch_uuid', $auditUuid);
        if ($allCandidates) {
            $query->where('classification', 'cleanup_candidate');
        } else {
            $query->whereIn('shipment_uuid', $selected);
            if ((clone $query)->count() !== count($selected) || (clone $query)->where('classification', '!=', 'cleanup_candidate')->exists()) {
                throw new InvalidArgumentException('Every selected shipment must be a cleanup candidate in this audit.');
            }
        }
        $count = (clone $query)->count();
        if ($count === 0) {
            throw new InvalidArgumentException('This audit has no cleanup candidates to apply.');
        }
        $batch = $this->batch('apply', $audit->merchant_id, ['selection' => $allCandidates ? 'all_candidates' : 'explicit', 'selected_shipments' => $selected, 'candidate_count' => $count], $auditUuid);
        // Bound memory for large audits; each item retains the same transactional checks.
        $items = $query->lazyById(100);
        foreach ($items as $item) {
            try {
                DB::transaction(function () use ($audit, $item, $batch) {
                    $shipment = Shipment::withTrashed()->where('merchant_id', $audit->merchant_id)->where('uuid', $item->shipment_uuid)->firstOrFail();
                    $this->lockContext($shipment);
                    $shipment->refresh();
                    if (! empty($shipment->metadata['geofence_cleanup_batch_uuid'])) {
                        $this->recordItem($batch, $item, 'already_applied');

                        return;
                    }
                    $result = $this->inspect($shipment->id);
                    if ($result['evidence']['classification'] !== 'cleanup_candidate' || $item->fingerprint !== $this->fingerprint($result['state'])) {
                        throw new RuntimeException('Stale audit or eligibility changed; audit again.');
                    }
                    $before = $result['state'];
                    $stamp = now()->toDateTimeString();
                    $metadata = $shipment->metadata ?? [];
                    $metadata['geofence_cleanup_batch_uuid'] = $batch;
                    // Direct writes avoid shipment/booking notifications, carrier calls or lifecycle replay.
                    DB::table('shipments')->where('id', $shipment->id)->update(['deleted_at' => $stamp, 'updated_at' => $stamp, 'metadata' => $this->json($metadata)]);
                    DB::table('bookings')->whereIn('id', array_column($before['bookings'], 'id'))->whereNull('deleted_at')->update(['deleted_at' => $stamp, 'updated_at' => $stamp]);
                    DB::table('run_shipments')->where('shipment_id', $shipment->id)->update(['status' => RunShipment::STATUS_REMOVED, 'updated_at' => $stamp]);
                    DB::table('vehicle_activity')->where('shipment_id', $shipment->id)->whereIn('event_type', self::EVENTS)->update(['geofence_cleanup_batch_uuid' => $batch, 'updated_at' => $stamp]);
                    $after = $this->inspect($shipment->id)['state'];
                    $this->recordItem($batch, $item, 'applied', $before, $after);
                }, 3);
            } catch (Throwable $e) {
                $this->recordItem($batch, $item, 'skipped', error: $e->getMessage());
            }
        }
        $this->finish($batch);

        return $batch;
    }

    public function restore(string $batch): array
    {
        $record = DB::table('geofence_cleanup_batches')->where('uuid', $batch)->where('mode', 'apply')->first();
        if (! $record) {
            throw new InvalidArgumentException('A cleanup batch UUID is required.');
        }
        $outcomes = [];
        $items = DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->whereIn('status', ['applied', 'restored'])->get();
        foreach ($items as $item) {
            try {
                $outcomes[$item->shipment_uuid] = DB::transaction(function () use ($record, $item, $batch) {
                    $shipment = Shipment::withTrashed()->where('merchant_id', $record->merchant_id)->where('uuid', $item->shipment_uuid)->firstOrFail();
                    $this->lockContext($shipment);
                    $current = DB::table('geofence_cleanup_items')->where('id', $item->id)->lockForUpdate()->first();
                    if ($current->status === 'restored') {
                        return 'already_restored';
                    }
                    $before = json_decode($current->before_state, true, flags: JSON_THROW_ON_ERROR);
                    $after = json_decode($current->after_state, true, flags: JSON_THROW_ON_ERROR);
                    $state = $this->inspect($shipment->id)['state'];
                    $shipment->refresh();
                    if (($shipment->metadata['geofence_cleanup_batch_uuid'] ?? null) !== $batch || $this->fingerprint($state) !== $this->fingerprint($after)) {
                        throw new RuntimeException('Records changed since cleanup; restore refused.');
                    }
                    $this->restoreRows('shipments', [$before['shipment']], ['deleted_at', 'updated_at', 'metadata']);
                    $this->restoreRows('bookings', $before['bookings'], ['deleted_at', 'updated_at']);
                    $this->restoreRows('run_shipments', $before['assignments'], ['status', 'updated_at']);
                    $this->restoreRows('vehicle_activity', array_values(array_filter($before['activities'], fn ($a) => in_array($a['event_type'], self::EVENTS, true))), ['geofence_cleanup_batch_uuid', 'updated_at']);
                    DB::table('geofence_cleanup_items')->where('id', $item->id)->update(['status' => 'restored', 'error' => null, 'updated_at' => now()]);

                    return 'restored';
                }, 3);
            } catch (Throwable $e) {
                DB::table('geofence_cleanup_items')->where('id', $item->id)->update(['error' => $e->getMessage(), 'updated_at' => now()]);
                $outcomes[$item->shipment_uuid] = $e->getMessage();
            }
        }
        $this->finish($batch);

        return $outcomes;
    }

    public function inspect(int $shipmentId, bool $reuseAuditEvidence = false): array
    {
        $shipment = Shipment::withTrashed()->findOrFail($shipmentId);
        $state = ['shipment' => $shipment->getRawOriginal()];
        $state['assignments'] = $this->rows('run_shipments', 'shipment_id', $shipmentId);
        $state['bookings'] = $this->rows('bookings', 'shipment_id', $shipmentId);
        $state['activities'] = $this->rows('vehicle_activity', 'shipment_id', $shipmentId);
        $state['parcels'] = $this->rows('shipment_parcels', 'shipment_id', $shipmentId);
        $state['imports'] = $this->rows('delivery_note_import_shipments', 'shipment_id', $shipmentId);
        $state['tracking'] = $this->rows('tracking_events', 'shipment_id', $shipmentId);
        $state['offers'] = $this->rows('delivery_offers', 'shipment_id', $shipmentId);
        $state['quotes'] = $this->rows('quotes', 'shipment_id', $shipmentId);
        $state['driver_assignments'] = DB::table('driver_assignments')->whereIn('booking_id', array_column($state['bookings'], 'id'))->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => (array) $r)->all();
        $state['pods'] = DB::table('booking_pods')->whereIn('booking_id', array_column($state['bookings'], 'id'))->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => (array) $r)->all();
        $state['logs'] = ActivityLog::where('merchant_id', $shipment->merchant_id)->where(function ($q) use ($shipment, $state) {
            $q->where(fn ($q) => $q->where('entity_type', 'shipment')->where('entity_id', $shipment->id))
                ->orWhere(fn ($q) => $q->where('entity_type', 'booking')->whereIn('entity_id', array_column($state['bookings'], 'id')));
        })->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => $r->getRawOriginal())->all();
        $e = ['shipment_uuid' => $shipment->uuid, 'reference' => $shipment->merchant_order_ref, 'run_uuid' => null, 'location_uuid' => null, 'location_name' => null, 'creation_time' => null, 'creation_latitude' => null, 'creation_longitude' => null, 'polygon_fingerprint' => null, 'interior_observations' => [], 'coverage' => null, 'reasons' => [], 'classification' => 'protected', 'proposed_changes' => []];
        $protect = [];
        if (! $shipment->auto_created || ($shipment->metadata['auto_created_from'] ?? null) !== 'vehicle_location_geofence') {
            $protect[] = 'not_explicit_geofence_creation';
        }
        if ($shipment->trashed()) {
            $protect[] = 'already_deleted';
        }
        if (in_array($shipment->status, ['cancelled', 'failed'], true)) {
            $protect[] = 'previously_cancelled_or_failed';
        }
        if ($shipment->invoice_number || $shipment->invoiced_at) {
            $protect[] = 'invoiced';
        }
        if ($shipment->delivery_note_number || $state['imports'] || ! empty($shipment->metadata['delivery_note_import_id'])) {
            $protect[] = 'delivery_note';
        }
        if ($state['pods']) {
            $protect[] = 'proof_of_delivery';
        }
        foreach ($state['parcels'] as $parcel) {
            if ($parcel['picked_up_scanned_at'] || $parcel['picked_up_scanned_by_user_id']) {
                $protect[] = 'parcel_scanned';
            }
        }
        if ($state['offers'] || $state['quotes'] || $state['driver_assignments']) {
            $protect[] = 'dispatch_or_quote_processing';
        }
        if ($state['tracking']) {
            $protect[] = 'tracking_or_manual_processing';
        }
        foreach ($state['bookings'] as $booking) {
            if ($booking['carrier_code'] !== 'internal' || $booking['carrier_job_id'] || $booking['quote_option_id'] || $booking['label_url']) {
                $protect[] = 'external_booking';
            }
            if ($booking['deleted_at']) {
                $protect[] = 'previously_deleted_booking';
            }
            if ((int) $booking['merchant_id'] !== (int) $shipment->merchant_id || (int) $booking['account_id'] !== (int) $shipment->account_id) {
                $protect[] = 'booking_scope_mismatch';
            }
        }
        foreach ($state['logs'] as $log) {
            if ($log['actor_user_id']) {
                $protect[] = 'recorded_manual_processing';
            }
        }
        if (! empty($shipment->metadata['status_source']) && $shipment->metadata['status_source'] !== 'automatic') {
            $protect[] = 'manual_status';
        }
        if (count($state['assignments']) !== 1) {
            $protect[] = 'ambiguous_run_association';
        }
        $runId = count($state['assignments']) === 1 ? $state['assignments'][0]['run_id'] : null;
        $run = $runId ? Run::withTrashed()->find($runId) : null;
        $state['run'] = $run?->getRawOriginal();
        if (! $run || (int) $run->merchant_id !== (int) $shipment->merchant_id || (int) $run->account_id !== (int) $shipment->account_id) {
            $protect[] = 'missing_or_foreign_run';
        } else {
            $e['run_uuid'] = $run->uuid;
            if (! in_array($run->status, ['completed', 'cancelled'], true) || ! $run->started_at || ! $run->completed_at || $run->completed_at <= $run->started_at || $run->trashed()) {
                $protect[] = 'open_or_invalid_run';
            }
        }
        $driver = DB::connection()->getDriverName();
        $locationQuery = DB::table('locations')->where('id', $shipment->dropoff_location_id)->where('merchant_id', $shipment->merchant_id);
        $location = $locationQuery->select('locations.*')->selectRaw(in_array($driver, ['mysql', 'pgsql']) ? 'ST_AsText(polygon_bounds) as polygon_wkt' : 'polygon_bounds as polygon_wkt')->lockForUpdate()->first();
        $state['location'] = $location ? (array) $location : null;
        // Binary spatial values are not JSON; retain the canonical WKT instead.
        if ($state['location']) {
            $state['location']['polygon_bounds'] = $location->polygon_wkt;
        }
        $polygon = GeofencePolygon::fromWkt($location?->polygon_wkt);
        if (! $polygon) {
            $protect[] = 'missing_or_invalid_polygon';
        }
        if ($location && (int) $location->account_id !== (int) $shipment->account_id) {
            $protect[] = 'location_scope_mismatch';
        }
        if ($location) {
            $e['location_uuid'] = $location->uuid;
            $e['location_name'] = $location->name;
            $e['polygon_fingerprint'] = hash('sha256', $location->polygon_wkt ?? '');
        }
        $state['location_logs'] = $location ? ActivityLog::where('merchant_id', $shipment->merchant_id)->where('entity_type', 'location')->where('entity_id', $location->id)->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => $r->getRawOriginal())->all() : [];
        foreach ($state['location_logs'] as $log) {
            if ($run?->started_at && CarbonImmutable::parse($log['occurred_at']) >= $run->started_at && array_key_exists('polygon_bounds', json_decode($log['changes'] ?? '{}', true) ?? [])) {
                $protect[] = 'polygon_changed_since_trip';
            }
        }
        $creations = array_values(array_filter($state['activities'], fn ($a) => $a['event_type'] === 'shipment_created'));
        $creation = count($creations) === 1 ? $creations[0] : null;
        if ($creation) {
            $e['creation_time'] = $creation['occurred_at'];
            $e['creation_latitude'] = $creation['latitude'];
            $e['creation_longitude'] = $creation['longitude'];
            if ((int) $creation['run_id'] !== (int) $runId || (int) $creation['location_id'] !== (int) $shipment->dropoff_location_id || (int) $creation['merchant_id'] !== (int) $shipment->merchant_id || (int) $creation['vehicle_id'] !== (int) $run?->vehicle_id) {
                $protect[] = 'creation_scope_mismatch';
            }
            if ($run?->started_at && $run->completed_at && ($creation['occurred_at'] < $run->started_at->toDateTimeString() || $creation['occurred_at'] > $run->completed_at->toDateTimeString())) {
                $protect[] = 'creation_outside_run';
            }
        }
        foreach ($state['activities'] as $a) {
            if ($a['geofence_cleanup_batch_uuid']) {
                $protect[] = 'previously_invalidated_activity';
            }
            $meta = json_decode($a['metadata'] ?? '{}', true) ?? [];
            if (! empty($meta['provider_position']['triggered_by_user_id']) || ! empty($meta['actor_user_id']) || ($meta['source'] ?? '') === 'manual') {
                $protect[] = 'manual_activity';
            }
            if ((int) $a['merchant_id'] !== (int) $shipment->merchant_id || ((int) $a['run_id'] !== (int) $runId && in_array($a['event_type'], self::EVENTS, true))) {
                $protect[] = 'activity_scope_mismatch';
            }
        }
        $trip = $this->tripEvidence($shipment, $run, $polygon, $location?->polygon_wkt, $reuseAuditEvidence);
        $state += $trip['state'];
        $e['coverage'] = $trip['coverage'];
        $e['interior_observations'] = $trip['interior_observations'];
        $protect = array_merge($protect, $trip['protect']);
        if ($creation && $polygon && $run?->started_at && $run->completed_at
            && $creation['latitude'] !== null && $creation['longitude'] !== null && $creation['occurred_at']) {
            $at = CarbonImmutable::parse($creation['occurred_at']);
            if ($at >= $run->started_at && $at <= $run->completed_at && $polygon->contains((float) $creation['latitude'], (float) $creation['longitude'])) {
                $e['interior_observations'][] = ['time' => $creation['occurred_at'], 'source' => 'creation', 'latitude' => $creation['latitude'], 'longitude' => $creation['longitude']];
            }
        }
        if ($protect) {
            $e['reasons'] = array_values(array_unique($protect));
        } elseif ($e['interior_observations']) {
            $e['classification'] = 'keep';
            $e['reasons'] = ['interior_evidence_in_same_run'];
        } elseif (! $creation || ! $this->validCoordinates($creation['latitude'], $creation['longitude']) || ! $e['coverage']['sample_endpoints'] || $e['coverage']['gaps'] || $e['coverage']['compressed_or_unknown_time']) {
            $e['classification'] = 'insufficient_evidence';
            $e['reasons'] = ['missing_ambiguous_creation_or_incomplete_gps'];
        } else {
            $e['classification'] = 'cleanup_candidate';
            $e['reasons'] = ['creation_outside_polygon_no_recorded_interior_observation'];
            $e['proposed_changes'] = ['soft_delete_shipment', 'soft_delete_internal_bookings', 'remove_run_assignment', 'hide_automatic_shipment_markers'];
        }

        return ['evidence' => $e, 'state' => $state];
    }

    private function tripEvidence(Shipment $shipment, ?Run $run, ?GeofencePolygon $polygon, ?string $wkt, bool $reuse): array
    {
        // Audit snapshots only. Apply/restore always reread and fingerprint live evidence.
        $key = $this->fingerprint([$shipment->account_id, $shipment->merchant_id, $run?->getRawOriginal(), $shipment->dropoff_location_id, $wkt]);
        if ($reuse && isset($this->auditTripEvidence[$key])) {
            return $this->auditTripEvidence[$key];
        }
        $state = [];
        $e = ['interior_observations' => []];
        $protect = [];
        $state['history'] = [];
        $state['run_activities'] = [];
        if ($run?->started_at && $run->completed_at && $run->vehicle_id) {
            $state['history'] = DB::table('vehicle_location_history')->where('merchant_id', $shipment->merchant_id)->where('account_id', $shipment->account_id)->where('vehicle_id', $run->vehicle_id)->where('observed_at', '<=', $run->completed_at)->where('last_seen_at', '>=', $run->started_at)->orderBy('observed_at')->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => (array) $r)->all();
            $state['run_activities'] = DB::table('vehicle_activity')->where('merchant_id', $shipment->merchant_id)->where('vehicle_id', $run->vehicle_id)->where('run_id', $run->id)->whereIn('event_type', ['entered_location', 'exited_location', 'moving', 'stopped', 'speeding'])->whereBetween('occurred_at', [$run->started_at, $run->completed_at])->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => (array) $r)->all();
        }
        $times = [];
        $compressed = false;
        $observe = function ($lat, $lng, $time, $source) use ($polygon, &$e, $run) {
            if ($lat === null || $lng === null || ! $time || ! $polygon || ! $run?->started_at || ! $run->completed_at) {
                return;
            }
            $at = CarbonImmutable::parse($time);
            if ($at >= $run->started_at && $at <= $run->completed_at && $polygon->contains((float) $lat, (float) $lng)) {
                $e['interior_observations'][] = ['time' => $time, 'source' => $source, 'latitude' => $lat, 'longitude' => $lng];
            }
        };
        foreach ($state['history'] as $h) {
            $observe($h['latitude'], $h['longitude'], $h['observed_at'], 'gps');
            $observe($h['last_latitude'], $h['last_longitude'], $h['last_seen_at'], 'gps');
            if (! $h['source_time_known'] || $h['sample_count'] > 2 || ! $this->validCoordinates($h['latitude'], $h['longitude']) || ! $this->validCoordinates($h['last_latitude'], $h['last_longitude'])) {
                $compressed = true;
            }
            if ($h['run_id'] !== null && (int) $h['run_id'] !== (int) $run->id) {
                $protect[] = 'history_assigned_to_another_run';
            }
            foreach ([$h['observed_at'], $h['last_seen_at']] as $time) {
                $at = CarbonImmutable::parse($time)->getTimestamp();
                if ($at >= $run->started_at->timestamp && $at <= $run->completed_at->timestamp) {
                    $times[] = $at;
                }
            }
        }
        foreach ($state['run_activities'] as $a) {
            // Mutable visit snapshots are useful only as conservative KEEP evidence.
            if ((int) $a['location_id'] === (int) $shipment->dropoff_location_id || in_array($a['event_type'], ['moving', 'stopped'], true)) {
                $observe($a['latitude'], $a['longitude'], $a['occurred_at'], 'activity');
            }
        }
        $gaps = [];
        if ($run?->started_at && $run->completed_at) {
            sort($times, SORT_NUMERIC);
            $previous = $run->started_at->timestamp;
            foreach ([...array_unique($times), $run->completed_at->timestamp] as $time) {
                if ($time - $previous > self::GAP_SECONDS) {
                    $gaps[] = ['from' => gmdate('c', $previous), 'to' => gmdate('c', $time), 'seconds' => $time - $previous];
                }
                $previous = max($previous, $time);
            }
        }
        $e['coverage'] = ['sample_endpoints' => count(array_unique($times)), 'maximum_allowed_gap_seconds' => self::GAP_SECONDS, 'gaps' => $gaps, 'compressed_or_unknown_time' => $compressed];
        // GPS and unrelated physical activities are preserved in their source tables.
        // Persist digests instead of duplicating a whole trip in every cleanup snapshot.
        foreach (['history', 'run_activities'] as $source) {
            $state[$source] = ['count' => count($state[$source]), 'fingerprint' => $this->fingerprint($state[$source])];
        }

        $result = ['state' => $state, 'coverage' => $e['coverage'], 'interior_observations' => $e['interior_observations'], 'protect' => array_values(array_unique($protect))];
        if ($reuse) {
            // Bound retained evidence by both entry count and serialized size (8 MiB).
            $bytes = strlen($this->json($result));
            if ($bytes <= 1048576) {
                if (count($this->auditTripEvidence) >= 8) {
                    array_shift($this->auditTripEvidence);
                }
                $this->auditTripEvidence[$key] = $result;
            }
        }

        return $result;
    }

    private function validCoordinates($lat, $lng): bool
    {
        return is_numeric($lat) && is_numeric($lng) && is_finite((float) $lat) && is_finite((float) $lng) && abs((float) $lat) <= 90 && abs((float) $lng) <= 180;
    }

    private function lockContext(Shipment $shipment): void
    {
        // Match lifecycle's vehicle-first locking; completed runs only are eligible.
        $ids = DB::table('run_shipments')->where('shipment_id', $shipment->id)->pluck('run_id');
        $vehicles = DB::table('runs')->whereIn('id', $ids)->pluck('vehicle_id')->filter()->unique()->sort()->values();
        DB::table('vehicles')->whereIn('id', $vehicles)->orderBy('id')->lockForUpdate()->get();
        DB::table('runs')->whereIn('id', $ids)->orderBy('id')->lockForUpdate()->get();
        DB::table('shipments')->where('id', $shipment->id)->lockForUpdate()->first();
    }

    private function rows(string $table, string $column, int $id): array
    {
        return DB::table($table)->where($column, $id)->orderBy('id')->lockForUpdate()->get()->map(fn ($r) => (array) $r)->all();
    }

    private function restoreRows(string $table, array $rows, array $fields): void
    {
        foreach ($rows as $row) {
            DB::table($table)->where('id', $row['id'])->update(array_intersect_key($row, array_flip($fields)));
        }
    }

    private function batch(string $mode, int $merchant, array $scope, ?string $audit = null): string
    {
        $id = (string) Str::uuid();
        DB::table('geofence_cleanup_batches')->insert(['uuid' => $id, 'mode' => $mode, 'audit_uuid' => $audit, 'merchant_id' => $merchant, 'scope' => $this->json($scope), 'status' => 'running', 'created_at' => now(), 'updated_at' => now()]);

        return $id;
    }

    private function recordItem(string $batch, object $auditItem, string $status, ?array $before = null, ?array $after = null, ?string $error = null): void
    {
        DB::table('geofence_cleanup_items')->insert(['batch_uuid' => $batch, 'shipment_uuid' => $auditItem->shipment_uuid, 'classification' => $auditItem->classification, 'status' => $status, 'evidence' => $auditItem->evidence, 'fingerprint' => $auditItem->fingerprint, 'before_state' => $before ? $this->json($before) : null, 'after_state' => $after ? $this->json($after) : null, 'error' => $error, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function finish(string $batch): void
    {
        $errors = DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->whereNotNull('error')->exists();
        DB::table('geofence_cleanup_batches')->where('uuid', $batch)->update(['status' => $errors ? 'partial' : 'complete', 'updated_at' => now()]);
    }

    private function date(string $value): CarbonImmutable
    {
        if (! preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$/', $value)) {
            throw new InvalidArgumentException('Use ISO 8601 dates with an explicit time zone.');
        }
        $date = CarbonImmutable::parse($value);
        if ($date->format('Y-m-d\TH:i:sP') !== str_replace('Z', '+00:00', $value)) {
            throw new InvalidArgumentException('Invalid date.');
        }

        return $date->utc();
    }

    private function json(mixed $data): string
    {
        return json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }

    private function fingerprint(array $state): string
    {
        return hash('sha256', $this->json($this->canonical($state)));
    }

    private function canonical(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        if (! array_is_list($value)) {
            ksort($value, SORT_STRING);
        }
        foreach ($value as $key => $child) {
            $value[$key] = $this->canonical($child);
        }

        return $value;
    }
}
