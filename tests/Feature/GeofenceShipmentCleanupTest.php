<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Booking;
use App\Models\BookingPod;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use App\Services\GeofenceShipmentCleanupService;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class GeofenceShipmentCleanupTest extends TestCase
{
    use RefreshDatabase;
    use \Tests\Support\DrawnGeofence;

    private function fixture(): array
    {
        $user = User::withoutEvents(fn () => User::factory()->create(['uuid' => (string) Str::uuid(), 'role' => 'super_admin']));
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::create(['account_id' => $account->id, 'owner_user_id' => $user->id, 'name' => 'Cleanup test', 'status' => 'active', 'timezone' => 'UTC', 'operating_countries' => ['ZA'], 'allow_auto_shipment_creations_at_locations' => true]);
        $vehicle = Vehicle::create(['account_id' => $account->id, 'plate_number' => (string) Str::uuid(), 'is_active' => true]);
        $location = Location::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'name' => 'Customer', 'address_line_1' => 'Test', 'city' => 'Test', 'province' => 'Test', 'post_code' => '0000', 'latitude' => -26, 'longitude' => 28, 'polygon_bounds' => $this->squareGeofence(-26, 28)]);
        $run = Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'status' => 'completed', 'started_at' => '2026-09-01 08:00:00', 'completed_at' => '2026-09-01 08:10:00', 'auto_created' => true]);
        $shipment = Shipment::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'merchant_order_ref' => 'AUTO-TEST-'.Str::uuid(), 'dropoff_location_id' => $location->id, 'status' => 'delivered', 'auto_created' => true, 'metadata' => ['auto_created_from' => 'vehicle_location_geofence']]);
        DB::table('shipments')->where('id', $shipment->id)->update(['created_at' => '2026-08-01 00:00:00']);
        $pivot = RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'status' => 'done']);
        $booking = Booking::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'shipment_id' => $shipment->id, 'carrier_code' => 'internal', 'status' => 'delivered', 'booked_at' => '2026-09-01 08:01:00']);
        $activity = VehicleActivity::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'run_id' => $run->id, 'shipment_id' => $shipment->id, 'location_id' => $location->id, 'event_type' => 'shipment_created', 'occurred_at' => '2026-09-01 08:01:00', 'latitude' => -26, 'longitude' => 28.0011]);
        foreach ([0, 2, 4, 6, 8, 10] as $minute) {
            $at = CarbonImmutable::parse('2026-09-01 08:00:00')->addMinutes($minute);
            DB::table('vehicle_location_history')->insert(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'vehicle_id' => $vehicle->id, 'merchant_integration_id' => 1, 'run_id' => $run->id, 'stationary' => false, 'observed_at' => $at, 'last_seen_at' => $at, 'received_at' => $at, 'latitude' => -26, 'longitude' => 28.0011, 'last_latitude' => -26, 'last_longitude' => 28.0011, 'first_sample_key' => (string) Str::uuid()]);
        }

        return compact('user', 'merchant', 'vehicle', 'location', 'run', 'shipment', 'pivot', 'booking', 'activity');
    }

    private function audit(array $f): string
    {
        return app(GeofenceShipmentCleanupService::class)->audit($f['merchant']->uuid, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
    }

    private function evidence(array $f): array
    {
        return app(GeofenceShipmentCleanupService::class)->inspect($f['shipment']->id)['evidence'];
    }

    public function test_cleanup_lookup_indexes_can_be_rolled_back_and_reapplied(): void
    {
        $migration = require database_path('migrations/2026_09_22_130000_add_geofence_cleanup_lookup_indexes.php');
        $indexes = ['shipments' => 'shipments_geofence_audit', 'vehicle_activity' => 'va_cleanup_creation', 'activity_logs' => 'activity_logs_entity_lookup'];
        foreach ($indexes as $table => $name) {
            $this->assertTrue(\Illuminate\Support\Facades\Schema::hasIndex($table, $name));
        }
        $migration->down();
        foreach ($indexes as $table => $name) {
            $this->assertFalse(\Illuminate\Support\Facades\Schema::hasIndex($table, $name));
        }
        $migration->up();
        foreach ($indexes as $table => $name) {
            $this->assertTrue(\Illuminate\Support\Facades\Schema::hasIndex($table, $name));
        }
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasIndex('vehicle_activity', 'va_cleanup_run'));
    }

    public function test_audit_reuses_trip_queries_preserves_evidence_and_apply_reads_fresh_history(): void
    {
        $f = $this->fixture();
        for ($i = 0; $i < 9; $i++) {
            $copy = $f['shipment']->replicate(['uuid']);
            $copy->merchant_order_ref = 'COPY-'.$i;
            $copy->save();
            RunShipment::create(['run_id' => $f['run']->id, 'shipment_id' => $copy->id, 'status' => 'done']);
            $event = $f['activity']->replicate(['uuid']);
            $event->shipment_id = $copy->id;
            $event->save();
        }
        $service = app(GeofenceShipmentCleanupService::class);
        DB::enableQueryLog();
        $progress = [];
        $audit = $service->audit($f['merchant']->uuid, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', null, function ($batch, $count) use (&$progress) {
            $progress[] = $count;
        });
        $queries = DB::getQueryLog();
        DB::disableQueryLog();
        DB::flushQueryLog();
        $this->assertCount(1, array_filter($queries, fn ($q) => str_contains($q['query'], 'select * from "vehicle_location_history"')));
        $this->assertSame([0, 1, 10], $progress);
        foreach (DB::table('geofence_cleanup_items')->where('batch_uuid', $audit)->get() as $item) {
            $id = Shipment::where('uuid', $item->shipment_uuid)->value('id');
            $this->assertEquals($service->inspect($id)['evidence'], json_decode($item->evidence, true));
        }
        // New interior evidence after the cached audit must prevent cleanup.
        DB::table('vehicle_location_history')->where('vehicle_id', $f['vehicle']->id)->update(['longitude' => 28, 'last_longitude' => 28]);
        $batch = $service->apply($audit, [$f['shipment']->uuid]);
        $this->assertSame('skipped', DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->value('status'));
        $this->assertNotNull(Shipment::find($f['shipment']->id));
        $freshAudit = $service->audit($f['merchant']->uuid, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z');
        $this->assertSame(10, DB::table('geofence_cleanup_items')->where('batch_uuid', $freshAudit)->where('classification', 'keep')->count());
    }

    public function test_audit_uses_creation_event_and_makes_no_domain_changes(): void
    {
        $f = $this->fixture();
        $audit = $this->audit($f);
        $item = DB::table('geofence_cleanup_items')->where('batch_uuid', $audit)->sole();
        $this->assertSame('cleanup_candidate', $item->classification);
        $e = json_decode($item->evidence, true);
        $this->assertSame('2026-09-01 08:01:00', $e['creation_time']);
        $this->assertNull($f['shipment']->fresh()->deleted_at);
        $this->assertSame('done', $f['pivot']->fresh()->status);
        $this->assertSame(1, Booking::count());
    }

    public function test_apply_restore_and_repeated_execution_preserve_source_data(): void
    {
        $f = $this->fixture();
        $visit = $f['activity']->replicate(['uuid']);
        $visit->event_type = 'entered_location';
        $visit->save();
        $service = app(GeofenceShipmentCleanupService::class);
        $audit = $this->audit($f);
        $batch = $service->apply($audit, [$f['shipment']->uuid]);
        $this->assertSame('applied', DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->value('status'));
        $this->assertSame(0, Shipment::count());
        $this->assertSame(0, Booking::count());
        $this->assertSame('removed', $f['pivot']->fresh()->status);
        $this->assertSame(0, VehicleActivity::where('event_type', 'shipment_created')->count());
        $this->assertSame(1, VehicleActivity::where('event_type', 'entered_location')->count());
        $this->assertSame(2, DB::table('vehicle_activity')->count());
        $this->assertSame(6, DB::table('vehicle_location_history')->count());
        $this->assertSame('completed', $f['run']->fresh()->status);
        $repeat = $service->apply($audit, [$f['shipment']->uuid]);
        $this->assertSame('already_applied', DB::table('geofence_cleanup_items')->where('batch_uuid', $repeat)->value('status'));
        $this->assertSame('restored', $service->restore($batch)[$f['shipment']->uuid]);
        $this->assertSame(1, Shipment::count());
        $this->assertSame(1, Booking::count());
        $this->assertSame('done', $f['pivot']->fresh()->status);
        $this->assertSame(2, VehicleActivity::count());
        $this->assertSame('already_restored', $service->restore($batch)[$f['shipment']->uuid]);
    }

    public function test_later_genuine_entry_is_kept_even_if_creation_was_outside(): void
    {
        $f = $this->fixture();
        DB::table('vehicle_location_history')->where('run_id', $f['run']->id)->orderByDesc('id')->limit(1)->update(['longitude' => 28, 'last_longitude' => 28]);
        $this->assertSame('keep', $this->evidence($f)['classification']);
    }

    public function test_gaps_compression_and_missing_creation_are_insufficient(): void
    {
        $f = $this->fixture();
        DB::table('vehicle_location_history')->where('run_id', $f['run']->id)->update(['sample_count' => 8]);
        $this->assertSame('insufficient_evidence', $this->evidence($f)['classification']);
        DB::table('vehicle_location_history')->where('run_id', $f['run']->id)->delete();
        $this->assertSame('insufficient_evidence', $this->evidence($f)['classification']);
        $f['activity']->delete();
        $this->assertSame('insufficient_evidence', $this->evidence($f)['classification']);
    }

    public function test_updated_visit_does_not_replace_original_creation_evidence(): void
    {
        $f = $this->fixture();
        $visit = $f['activity']->replicate(['uuid']);
        $visit->event_type = 'entered_location';
        $visit->latitude = -25;
        $visit->save();
        $this->assertEquals(28.0011, $this->evidence($f)['creation_longitude']);
        $this->assertSame('cleanup_candidate', $this->evidence($f)['classification']);
    }

    public function test_each_protected_case_is_never_eligible(): void
    {
        $cases = [
            'open_or_invalid_run' => fn ($f) => $f['run']->update(['status' => 'in_progress', 'completed_at' => null]),
            'invoiced' => fn ($f) => $f['shipment']->update(['invoice_number' => 'INV-1']),
            'delivery_note' => fn ($f) => $f['shipment']->update(['delivery_note_number' => 'DN-1']),
            'missing_or_invalid_polygon' => fn ($f) => $f['location']->update(['polygon_bounds' => null]),
            'external_booking' => fn ($f) => $f['booking']->update(['carrier_code' => 'external']),
            'proof_of_delivery' => fn ($f) => BookingPod::create(['account_id' => $f['merchant']->account_id, 'booking_id' => $f['booking']->id, 'file_key' => 'proof.jpg', 'file_type' => 'image/jpeg']),
            'manual_status' => fn ($f) => $f['shipment']->update(['metadata' => ['auto_created_from' => 'vehicle_location_geofence', 'status_source' => 'driver']]),
            'ambiguous_run_association' => fn ($f) => $f['pivot']->delete(),
            'polygon_changed_since_trip' => fn ($f) => ActivityLog::create(['account_id' => $f['merchant']->account_id, 'merchant_id' => $f['merchant']->id, 'action' => 'updated', 'entity_type' => 'location', 'entity_id' => $f['location']->id, 'changes' => ['polygon_bounds' => ['from' => 'old', 'to' => 'new']], 'occurred_at' => '2026-09-02 00:00:00']),
            'recorded_manual_processing' => fn ($f) => ActivityLog::create(['account_id' => $f['merchant']->account_id, 'merchant_id' => $f['merchant']->id, 'action' => 'updated', 'entity_type' => 'shipment', 'entity_id' => $f['shipment']->id, 'actor_user_id' => $f['user']->id, 'occurred_at' => '2026-09-02 00:00:00']),
        ];
        foreach ($cases as $reason => $mutate) {
            $f = $this->fixture();
            $mutate($f);
            $e = $this->evidence($f);
            $this->assertSame('protected', $e['classification'], $reason);
            $this->assertContains($reason, $e['reasons']);
        }
    }

    public function test_audit_is_scoped_and_apply_requires_reviewed_selection(): void
    {
        $f = $this->fixture();
        $other = $this->fixture();
        $service = app(GeofenceShipmentCleanupService::class);
        $audit = $this->audit($f);
        $this->assertSame(1, DB::table('geofence_cleanup_items')->where('batch_uuid', $audit)->count());
        foreach ([[], [$other['shipment']->uuid]] as $selected) {
            try {
                $service->apply($audit, $selected);
                $this->fail('Selection should fail.');
            } catch (\InvalidArgumentException $e) {
                $this->assertNotEmpty($e->getMessage());
            }
        }
        $this->assertSame(2, Shipment::count());
    }

    public function test_changed_evidence_rejects_stale_audit(): void
    {
        $f = $this->fixture();
        $audit = $this->audit($f);
        $f['shipment']->update(['notes' => 'Reviewed manually']);
        $batch = app(GeofenceShipmentCleanupService::class)->apply($audit, [$f['shipment']->uuid]);
        $this->assertSame('skipped', DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->value('status'));
        $this->assertSame(1, Shipment::count());
    }

    public function test_restore_refuses_intervening_booking_edit(): void
    {
        $f = $this->fixture();
        $service = app(GeofenceShipmentCleanupService::class);
        $batch = $service->apply($this->audit($f), [$f['shipment']->uuid]);
        DB::table('bookings')->where('id', $f['booking']->id)->update(['cancel_reason' => 'Changed']);
        $this->assertStringContainsString('changed', $service->restore($batch)[$f['shipment']->uuid]);
        $this->assertSame(0, Shipment::count());
    }

    public function test_database_error_rolls_back_entire_shipment_cleanup(): void
    {
        $f = $this->fixture();
        $audit = $this->audit($f);
        DB::unprepared("CREATE TRIGGER reject_cleanup BEFORE UPDATE OF status ON run_shipments BEGIN SELECT RAISE(ABORT, 'test failure'); END");
        $batch = app(GeofenceShipmentCleanupService::class)->apply($audit, [$f['shipment']->uuid]);
        $this->assertSame('skipped', DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->value('status'));
        $this->assertSame(1, Shipment::count());
        $this->assertSame(1, Booking::count());
        $this->assertSame(1, VehicleActivity::count());
        $this->assertSame('done', $f['pivot']->fresh()->status);
    }

    public function test_multiple_shipments_on_same_run_can_be_cleaned_and_restored(): void
    {
        $f = $this->fixture();
        $second = $f['shipment']->replicate(['uuid']);
        $second->merchant_order_ref = 'SECOND';
        $second->save();
        RunShipment::create(['run_id' => $f['run']->id, 'shipment_id' => $second->id, 'status' => 'done']);
        $event = $f['activity']->replicate(['uuid']);
        $event->shipment_id = $second->id;
        $event->save();
        $service = app(GeofenceShipmentCleanupService::class);
        $batch = $service->apply($this->audit($f), [$f['shipment']->uuid, $second->uuid]);
        $this->assertSame(2, DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->where('status', 'applied')->count());
        $this->assertSame(['restored', 'restored'], array_values($service->restore($batch)));
    }

    public function test_lifecycle_cannot_resurrect_a_cleanup_deleted_shipment(): void
    {
        $f = $this->fixture();
        $origin = $f['location']->replicate(['uuid']);
        $origin->polygon_bounds = $this->squareGeofence(-27, 29);
        $origin->save();
        $type = \App\Models\LocationType::create(['account_id' => $f['merchant']->account_id, 'merchant_id' => $f['merchant']->id, 'slug' => 'customer', 'title' => 'Customer', 'collection_point' => false, 'delivery_point' => true]);
        $f['location']->update(['location_type_id' => $type->id]);
        $f['run']->update(['origin_location_id' => $origin->id]);
        $f['shipment']->update(['merchant_order_ref' => 'AUTO-SHIP-'.$f['run']->id.'-'.$f['location']->id]);
        app(GeofenceShipmentCleanupService::class)->apply($this->audit($f), [$f['shipment']->uuid]);
        $f['run']->update(['status' => 'in_progress', 'completed_at' => null]);
        app(\App\Services\AutoRunLifecycleService::class)->processVehiclePosition($f['vehicle'], $f['merchant'], -26, 28);
        $this->assertSame(0, Shipment::count());
        $this->assertSame(1, Shipment::withTrashed()->count());
        $this->assertSame(0, Booking::count());
    }

    public function test_cleaned_records_disappear_from_report_and_run_detail(): void
    {
        $f = $this->fixture();
        $visit = $f['activity']->replicate(['uuid']);
        $visit->event_type = 'entered_location';
        $visit->save();
        app(GeofenceShipmentCleanupService::class)->apply($this->audit($f), [$f['shipment']->uuid]);
        $token = $f['user']->createToken('test')->plainTextToken;
        $this->withToken($token)->getJson('/api/v1/reports/shipments_full_report?merchant_id='.$f['merchant']->uuid)->assertOk()->assertJsonCount(0, 'data');
        $this->withToken($token)->getJson('/api/v1/runs/'.$f['run']->uuid)->assertOk()->assertJsonCount(0, 'data.shipments')->assertJsonCount(1, 'data.stops')->assertJsonPath('data.shipment_count', 0);
        $this->withToken($token)->getJson('/api/v1/bookings?merchant_id='.$f['merchant']->uuid)->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_alias_queries_hide_invalidated_markers(): void
    {
        $f = $this->fixture();
        app(GeofenceShipmentCleanupService::class)->apply($this->audit($f), [$f['shipment']->uuid]);
        $this->assertSame(0, VehicleActivity::from('vehicle_activity as candidates')->count());
        $this->assertSame(1, VehicleActivity::withoutGlobalScope('valid_geofence_activity')->count());
    }

    public function test_new_gps_evidence_or_polygon_changes_invalidate_an_audit(): void
    {
        foreach (['gps', 'polygon'] as $case) {
            $f = $this->fixture();
            $audit = $this->audit($f);
            if ($case === 'gps') {
                DB::table('vehicle_location_history')->where('run_id', $f['run']->id)->update(['longitude' => 28]);
            } else {
                $f['location']->update(['polygon_bounds' => $this->squareGeofence(-26.1, 28)]);
            }
            $batch = app(GeofenceShipmentCleanupService::class)->apply($audit, [$f['shipment']->uuid]);
            $this->assertSame('skipped', DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->value('status'));
            $this->assertNotNull(Shipment::find($f['shipment']->id));
        }
    }

    public function test_missing_creation_is_included_as_insufficient_and_cannot_be_applied(): void
    {
        $f = $this->fixture();
        $f['activity']->delete();
        $audit = $this->audit($f);
        $this->assertSame('insufficient_evidence', DB::table('geofence_cleanup_items')->where('batch_uuid', $audit)->value('classification'));
        $this->expectException(\InvalidArgumentException::class);
        app(GeofenceShipmentCleanupService::class)->apply($audit, [$f['shipment']->uuid]);
    }

    public function test_parcel_scans_tracking_and_import_links_are_protected(): void
    {
        $f = $this->fixture();
        $parcel = app(\App\Services\ShipmentParcelService::class)->createDefaultAutoCreatedParcel($f['shipment']);
        $parcel->update(['picked_up_scanned_at' => now()]);
        $this->assertContains('parcel_scanned', $this->evidence($f)['reasons']);
        $f = $this->fixture();
        \App\Models\TrackingEvent::create(['merchant_id' => $f['merchant']->id, 'shipment_id' => $f['shipment']->id, 'event_code' => 'delivered', 'occurred_at' => now(), 'payload' => ['actor_id' => $f['user']->id]]);
        $this->assertContains('tracking_or_manual_processing', $this->evidence($f)['reasons']);
        $f = $this->fixture();
        $importId = DB::table('delivery_note_imports')->insertGetId(['uuid' => (string) Str::uuid(), 'merchant_id' => $f['merchant']->id, 'run_id' => $f['run']->id, 'disk' => 'local', 'path' => 'test', 'original_name' => 'test.pdf', 'mime_type' => 'application/pdf', 'size_bytes' => 1]);
        DB::table('delivery_note_import_shipments')->insert(['shipment_id' => $f['shipment']->id, 'delivery_note_import_id' => $importId]);
        $this->assertContains('delivery_note', $this->evidence($f)['reasons']);
    }

    public function test_restore_fingerprints_ignore_json_object_key_order(): void
    {
        $f = $this->fixture();
        $service = app(GeofenceShipmentCleanupService::class);
        $batch = $service->apply($this->audit($f), [$f['shipment']->uuid]);
        $item = DB::table('geofence_cleanup_items')->where('batch_uuid', $batch)->sole();
        $state = json_decode($item->after_state, true);
        // Native JSON databases can reorder object keys when storing snapshots.
        krsort($state);
        krsort($state['shipment']);
        DB::table('geofence_cleanup_items')->where('id', $item->id)->update(['after_state' => json_encode($state)]);
        $this->assertSame('restored', $service->restore($batch)[$f['shipment']->uuid]);
    }

    public function test_multiple_run_associations_and_foreign_run_filter_are_rejected(): void
    {
        $f = $this->fixture();
        $other = $this->fixture();
        RunShipment::create(['run_id' => $other['run']->id, 'shipment_id' => $f['shipment']->id, 'status' => 'done']);
        $this->assertContains('ambiguous_run_association', $this->evidence($f)['reasons']);
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
        app(GeofenceShipmentCleanupService::class)->audit($f['merchant']->uuid, '2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z', $other['run']->uuid);
    }

    public function test_audit_rejects_invalid_or_unbounded_dates(): void
    {
        $f = $this->fixture();
        foreach ([['2026-09-01', '2026-09-02'], ['2026-09-02T00:00:00Z', '2026-09-01T00:00:00Z'], ['2026-02-30T00:00:00Z', '2026-09-01T00:00:00Z']] as [$from, $to]) {
            try {
                app(GeofenceShipmentCleanupService::class)->audit($f['merchant']->uuid, $from, $to);
                $this->fail('Invalid scope should fail.');
            } catch (\InvalidArgumentException $e) {
                $this->assertNotEmpty($e->getMessage());
            }
        }
        $this->assertSame(0, DB::table('geofence_cleanup_batches')->count());
    }

    public function test_all_candidates_command_applies_only_audit_candidates_and_rechecks_stale_rows(): void
    {
        $f = $this->fixture();
        $other = $this->fixture();
        $copies = [];
        foreach (['stale', 'protected', 'insufficient'] as $kind) {
            $copy = $f['shipment']->replicate(['uuid']);
            $copy->merchant_order_ref = $kind;
            if ($kind === 'protected') {
                $copy->invoice_number = 'INVOICED';
            }
            $copy->save();
            RunShipment::create(['run_id' => $f['run']->id, 'shipment_id' => $copy->id, 'status' => 'done']);
            if ($kind !== 'insufficient') {
                $event = $f['activity']->replicate(['uuid']);
                $event->shipment_id = $copy->id;
                $event->save();
            }
            $copies[$kind] = $copy;
        }
        $audit = $this->audit($f);
        $copies['stale']->update(['notes' => 'Changed after audit']);
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'apply', '--audit' => $audit, '--all-candidates' => true])->assertFailed();
        $batch = DB::table('geofence_cleanup_batches')->where('mode', 'apply')->sole();
        $this->assertSame(2, DB::table('geofence_cleanup_items')->where('batch_uuid', $batch->uuid)->count());
        $this->assertSame(1, DB::table('geofence_cleanup_items')->where('batch_uuid', $batch->uuid)->where('status', 'applied')->count());
        $this->assertSame(1, DB::table('geofence_cleanup_items')->where('batch_uuid', $batch->uuid)->where('status', 'skipped')->count());
        $this->assertSame('all_candidates', json_decode($batch->scope, true)['selection']);
        $this->assertNull(Shipment::find($f['shipment']->id));
        foreach ([...array_values($copies), $other['shipment']] as $kept) {
            $this->assertNotNull(Shipment::find($kept->id));
        }
        $this->assertSame('restored', app(GeofenceShipmentCleanupService::class)->restore($batch->uuid)[$f['shipment']->uuid]);
        $directory = storage_path('app/private/geofence-cleanup/'.$batch->uuid);
        unlink($directory.'/report.json');
        unlink($directory.'/report.csv');
        rmdir($directory);
    }

    public function test_all_candidates_rejects_conflicting_flags_wrong_modes_and_empty_audits(): void
    {
        $f = $this->fixture();
        $audit = $this->audit($f);
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'apply', '--audit' => $audit, '--all-candidates' => true, '--shipment' => [$f['shipment']->uuid]])->assertFailed();
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'audit', '--all-candidates' => true])->assertFailed();
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'restore', '--all-candidates' => true])->assertFailed();
        $f['shipment']->update(['invoice_number' => 'INV']);
        $empty = $this->audit($f);
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'apply', '--audit' => $empty, '--all-candidates' => true])->expectsOutput('This audit has no cleanup candidates to apply.')->assertFailed();
        $this->assertSame(0, DB::table('geofence_cleanup_batches')->where('mode', 'apply')->count());
        $this->assertNotNull(Shipment::find($f['shipment']->id));
    }

    public function test_command_validates_scope_and_exports_reports(): void
    {
        $f = $this->fixture();
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'audit'])->assertFailed();
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'audit', '--merchant' => $f['merchant']->uuid, '--from' => '2026-09-01T00:00:00Z', '--to' => '2026-09-02T00:00:00Z'])->assertSuccessful();
        $id = DB::table('geofence_cleanup_batches')->value('uuid');
        $directory = storage_path('app/private/geofence-cleanup/'.$id);
        $report = json_decode(file_get_contents($directory.'/report.json'), true, flags: JSON_THROW_ON_ERROR);
        $this->assertSame('cleanup_candidate', $report['items'][0]['classification']);
        $this->assertFileExists($directory.'/report.csv');
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'apply', '--audit' => $id, '--shipment' => [$f['shipment']->uuid]])->assertSuccessful();
        $batch = DB::table('geofence_cleanup_batches')->where('mode', 'apply')->value('uuid');
        $this->artisan('shipments:cleanup-geofence', ['mode' => 'restore', '--batch' => $batch])->assertSuccessful();
        foreach ([$id, $batch] as $reportId) {
            $directory = storage_path('app/private/geofence-cleanup/'.$reportId);
            unlink($directory.'/report.json');
            unlink($directory.'/report.csv');
            rmdir($directory);
        }
    }
}
