<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\DeliveryNoteImport;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverDocumentImportTest extends TestCase
{
    use RefreshDatabase;

    private function apiAs(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }

    private function draft(): array
    {
        $address = ['address_line_1' => '10 Example Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2196', 'country' => 'ZA'];

        return ['grouping_mode' => 'separate_shipments', 'collection_date' => '2026-09-15', 'pickup_address' => $address, 'dropoff_address' => $address,
            'line_items' => [
                ['merchant_order_ref' => 'TODAY', 'description' => 'Boxes', 'quantity' => 2, 'pickup_address' => $address, 'dropoff_address' => $address],
                ['merchant_order_ref' => 'FUTURE', 'description' => 'Box', 'collection_date' => '2026-09-16', 'pickup_address' => $address, 'dropoff_address' => $address],
                ['merchant_order_ref' => 'OLD', 'description' => 'Box', 'collection_date' => '2026-09-14', 'pickup_address' => $address, 'dropoff_address' => $address],
            ]];
    }

    private function import($user, $merchant, $run = null): DeliveryNoteImport
    {
        return DeliveryNoteImport::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'run_id' => $run?->id, 'uploaded_by_user_id' => $user->id, 'status' => 'analyzed', 'disk' => 'local',
            'path' => 'test.png', 'original_name' => 'test.png', 'mime_type' => 'image/png', 'size_bytes' => 10, 'extracted_data' => $this->draft()]);
    }

    public function test_driver_file_preview_streams_only_owned_images(): void
    {
        Storage::fake('local');
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        Storage::disk('local')->put($import->path, 'private-image-bytes');
        $url = "/api/v1/driver/document-imports/{$import->uuid}/file-preview";
        $response = $this->apiAs($user)->get($url)->assertOk()->assertHeader('Content-Type', 'image/png');
        $this->assertSame('private-image-bytes', $response->streamedContent());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        [$otherUser] = $this->createDriverContext();
        $this->apiAs($otherUser)->get($url)->assertNotFound();
        $import->update(['mime_type' => 'application/pdf']);
        $this->apiAs($user)->get($url)->assertStatus(415);
        $import->update(['mime_type' => 'image/png']);
        Storage::disk('local')->delete($import->path);
        $this->apiAs($user)->get($url)->assertNotFound();
    }

    public function test_location_search_accepts_a_single_character_and_keeps_merchant_scope(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $location = \App\Models\Location::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'address_line_1' => 'Alpha Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2196', 'name' => 'A Depot', 'full_address' => 'Alpha Street', 'latitude' => -26.2, 'longitude' => 28.0]);
        [$otherUser, $otherMerchant] = $this->createDriverContext();
        \App\Models\Location::create(['account_id' => $otherMerchant->account_id, 'merchant_id' => $otherMerchant->id,
            'address_line_1' => 'Alpha Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2196', 'name' => 'A Other Depot', 'latitude' => -26.2, 'longitude' => 28.0]);
        Http::fake();
        $this->apiAs($user)->postJson('/api/v1/driver/trip-locations/search', ['query' => 'A'])
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.location_id', $location->uuid);
        Http::assertNothingSent();
    }

    public function test_location_search_paginates_saved_matches_without_duplicates_or_geocoding_later_pages(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $ids = [];
        for ($i = 0; $i < 41; $i++) {
            $location = \App\Models\Location::create(array_merge($this->draft()['pickup_address'], [
                'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'name' => 'Paged depot '.$i, 'latitude' => -26.1, 'longitude' => 28.1,
            ]));
            $ids[] = $location->uuid;
        }
        Http::fake();
        $found = [];
        foreach ([1 => 20, 2 => 20, 3 => 1, 4 => 0] as $page => $count) {
            $response = $this->apiAs($user)->postJson('/api/v1/driver/trip-locations/search', ['query' => 'Paged', 'page' => $page])
                ->assertOk()->assertJsonCount($count, 'data')->assertJsonPath('meta.next_page', $page < 3 ? $page + 1 : null);
            $found = array_merge($found, array_column($response->json('data'), 'location_id'));
        }
        $this->assertSame($ids, $found);
        Http::assertNothingSent();
        $this->apiAs($user)->postJson('/api/v1/driver/trip-locations/search', ['query' => 'Paged', 'page' => 0])->assertUnprocessable();
    }

    public function test_analysis_creates_nothing_and_confirmation_attaches_all_dates_and_is_idempotent(): void
    {
        $this->travelTo(\Carbon\Carbon::parse('2026-09-14 23:30:00', 'UTC'));
        [$user, $merchant] = $this->createDriverContext();
        $merchant->update(['timezone' => 'Africa/Johannesburg']);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'in_progress']);
        Storage::fake('local');
        config(['filesystems.default' => 'local', 'services.openai.api_key' => 'test']);
        Http::fake(['api.openai.com/v1/responses' => Http::response(['model' => 'test', 'output' => [['content' => [['type' => 'output_text', 'text' => json_encode($this->draft())]]]]])]);
        $this->apiAs($user)->getJson('/api/v1/driver/document-imports/context')->assertOk()->assertJsonPath('data.today', '2026-09-15')->assertJsonCount(1, 'data.runs');
        $analysis = $this->apiAs($user)->post('/api/v1/driver/document-imports', ['run_id' => $run->uuid, 'file' => UploadedFile::fake()->image('note.png')])->assertCreated();
        $this->assertDatabaseCount('shipments', 0);
        $id = $analysis->json('data.import_id');
        $response = $this->apiAs($user)->postJson("/api/v1/driver/document-imports/$id/confirm", $this->draft())->assertOk()
            ->assertJsonCount(3, 'data.created')->assertJsonPath('data.attached', ['TODAY', 'FUTURE', 'OLD'])->assertJsonPath('data.unassigned', []);
        $this->assertDatabaseCount('run_shipments', 3);
        $this->assertDatabaseCount('shipment_parcels', 4);
        $this->assertDatabaseHas('shipments', ['merchant_order_ref' => 'TODAY', 'collection_date' => '2026-09-14 22:00:00']);
        $repeat = $this->apiAs($user)->postJson("/api/v1/driver/document-imports/$id/confirm", $this->draft())->assertOk();
        $this->assertSame($response->json('data'), $repeat->json('data'));
        $this->assertDatabaseCount('shipments', 3);
    }

    public function test_existing_references_are_skipped_and_no_run_is_required(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $first = $this->import($user, $merchant);
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$first->uuid}/confirm", $this->draft())->assertOk()->assertJsonCount(3, 'data.unassigned');
        Shipment::where('merchant_order_ref', 'TODAY')->first()->delete();
        $second = $this->import($user, $merchant);
        $this->apiAs($user)->getJson("/api/v1/driver/document-imports/{$second->uuid}")->assertOk()->assertJsonCount(3, 'data.existing_references');
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$second->uuid}/confirm", $this->draft())->assertOk()->assertJsonCount(0, 'data.created')->assertJsonCount(3, 'data.skipped');
        $this->assertSame(3, Shipment::withTrashed()->count());
        $this->assertDatabaseCount('run_shipments', 0);
    }

    public function test_other_driver_access_and_reassigned_runs_are_rejected(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        [$other] = $this->createDriverContext($merchant);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'in_progress']);
        $import = $this->import($user, $merchant, $run);
        $this->apiAs($other)->getJson("/api/v1/driver/document-imports/{$import->uuid}")->assertNotFound();
        $this->apiAs($other)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $this->draft())->assertNotFound();
        $this->apiAs($other)->post('/api/v1/driver/document-imports', ['run_id' => $run->uuid, 'file' => UploadedFile::fake()->image('note.png')])->assertNotFound();
        $run->update(['driver_id' => $other->driver->id]);
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $this->draft())->assertStatus(409);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_review_requires_real_dates_addresses_and_unique_references(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $url = "/api/v1/driver/document-imports/{$import->uuid}/confirm";
        $draft = $this->draft();
        $draft['collection_date'] = '';
        $this->apiAs($user)->postJson($url, $draft)->assertStatus(422);
        $draft = $this->draft();
        $draft['line_items'][1]['merchant_order_ref'] = 'TODAY';
        $this->apiAs($user)->postJson($url, $draft)->assertStatus(422);
        $draft = $this->draft();
        $draft['line_items'][0]['pickup_address'] = [];
        $this->apiAs($user)->postJson($url, $draft)->assertStatus(422);
        $draft = $this->draft();
        $draft['pickup_location_id'] = (string) Str::uuid();
        $this->apiAs($user)->postJson($url, $draft)->assertStatus(422);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_single_shipment_grouping_combines_parcels(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->draft();
        $draft['grouping_mode'] = 'single_shipment';
        $draft['merchant_order_ref'] = 'COMBINED';
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertOk()->assertJsonPath('data.created', ['COMBINED']);
        $this->assertDatabaseCount('shipments', 1);
        $this->assertDatabaseCount('shipment_parcels', 4);
    }

    public function test_failed_ai_extraction_creates_no_shipments_and_records_failure(): void
    {
        [$user] = $this->createDriverContext();
        Storage::fake('local');
        config(['filesystems.default' => 'local', 'services.openai.api_key' => 'test']);
        Http::fake(['api.openai.com/v1/responses' => Http::response(['error' => 'Unavailable'], 503)]);
        $this->apiAs($user)->post('/api/v1/driver/document-imports', ['file' => UploadedFile::fake()->image('note.png')])->assertServerError();
        $this->assertDatabaseHas('delivery_note_imports', ['status' => 'failed']);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_review_can_select_an_owned_run_after_extraction(): void
    {
        $this->travelTo(\Carbon\Carbon::parse('2026-09-15 12:00:00', 'UTC'));
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'in_progress']);
        $draft = $this->draft(); $draft['run_id'] = $run->uuid;
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)
            ->assertOk()->assertJsonPath('data.attached', ['TODAY', 'FUTURE', 'OLD']);
        $this->assertSame($run->id, $import->fresh()->run_id);
        $this->assertDatabaseCount('shipments', 3);
        $this->assertDatabaseCount('run_shipments', 3);
    }

    public function test_review_cannot_select_another_drivers_run(): void
    {
        [$user, $merchant] = $this->createDriverContext(); [$other] = $this->createDriverContext($merchant);
        $import = $this->import($user, $merchant);
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $other->driver->id, 'status' => 'in_progress']);
        $draft = $this->draft(); $draft['run_id'] = $run->uuid;
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertStatus(409);
        $this->assertDatabaseCount('shipments', 0);
        $this->assertNull($import->fresh()->run_id);
    }

    private function plannedDraft($user, $merchant): array
    {
        $location = \App\Models\Location::create(array_merge($this->draft()['pickup_address'], ['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Depot', 'latitude' => -26.1, 'longitude' => 28.1]));
        $vehicle = \App\Models\Vehicle::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'plate_number' => 'TEST-1']);
        $user->driver->vehicles()->attach($vehicle->id);
        return array_merge($this->draft(), ['run_id' => null, 'create_new_run' => true, 'vehicle_id' => $vehicle->uuid, 'origin_location_id' => $location->uuid, 'destination_location_id' => $location->uuid]);
    }

    public function test_five_step_review_creates_ready_run_only_at_confirmation(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        // Empty optional AI fields and different object key order must not invalidate review.
        $draft['line_items'][0]['type'] = '';
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->assertJsonPath('data.rows.0.collection_comparison', 'match');
        $this->assertDatabaseCount('runs', 0);
        $this->assertDatabaseCount('shipments', 0);
        $draft['review_token'] = $preview->json('data.review_token');
        $response = $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk()->assertJsonCount(3, 'data.attached');
        $run = Run::where('uuid', $response->json('data.run_id'))->firstOrFail();
        $this->assertSame('draft', $run->status);
        $this->assertTrue($run->driver_workflow);
        $this->assertNotNull($run->origin_location_id);
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk();
        $this->assertDatabaseCount('runs', 1);
    }

    public function test_matching_visit_is_rechecked_and_manual_override_is_preserved(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $location = \App\Models\Location::where('uuid', $draft['origin_location_id'])->firstOrFail();
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'in_progress']);
        $draft['run_id'] = $run->uuid; $draft['create_new_run'] = false;
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk();
        $draft['review_token'] = $preview->json('data.review_token');
        $visit = \App\Models\VehicleActivity::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'run_id' => $run->id, 'vehicle_id' => $user->driver->vehicles()->first()->id, 'location_id' => $location->id, 'event_type' => 'shipment_delivery', 'occurred_at' => now()->subHour()]);
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertStatus(409);
        $this->assertDatabaseCount('shipments', 0);
        $draft['line_items'][1]['status'] = 'in_transit';
        $draft['line_items'][1]['odometer_at_collection'] = 100;
        $draft['line_items'][2]['odometer_at_collection'] = 100;
        $draft['line_items'][2]['status'] = 'failed';
        $draft['line_items'][2]['failure_reason'] = 'Customer refused delivery';
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->assertJsonPath('data.rows.0.status', 'delivered')->assertJsonPath('data.rows.1.status', 'in_transit');
        $draft['review_token'] = $preview->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk()->assertJsonPath('data.delivered', ['TODAY']);
        $shipment = Shipment::where('merchant_order_ref', 'TODAY')->firstOrFail();
        $this->assertSame($visit->uuid, $shipment->metadata['matched_stop_id']);
        $this->assertDatabaseHas('shipments', ['merchant_order_ref' => 'FUTURE', 'status' => 'in_transit']);
        $this->assertDatabaseHas('tracking_events', ['event_code' => 'failed', 'event_description' => 'Customer refused delivery']);
    }

    public function test_failed_reason_and_no_empty_run_are_enforced(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $draft['line_items'][0]['status'] = 'failed';
        $draft['line_items'][0]['failure_reason'] = '   ';
        $draft['review_token'] = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertStatus(422);
        unset($draft['line_items'][0]['status'], $draft['line_items'][0]['failure_reason']);
        foreach ($draft['line_items'] as &$row) $row['excluded'] = true;
        unset($row);
        $draft['review_token'] = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertStatus(422);
        $this->assertDatabaseCount('runs', 0);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_excluding_an_unreadable_row_does_not_block_valid_shipments(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $draft['line_items'][] = ['merchant_order_ref' => null, 'description' => null, 'quantity' => -2, 'excluded' => true];
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $draft['review_token'] = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk()->assertJsonCount(3, 'data.created')->assertJsonCount(1, 'data.skipped');
    }

    public function test_missing_shipment_addresses_remain_blank_after_analysis_and_block_confirmation(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        Storage::fake('local');
        config(['filesystems.default' => 'local', 'services.openai.api_key' => 'test']);
        foreach ([['pickup_address'], ['dropoff_address'], ['pickup_address', 'dropoff_address']] as $missing) {
            $data = $this->draft();
            foreach ($missing as $kind) $data['line_items'][0][$kind] = array_fill_keys(array_keys($data[$kind]), null);
            Http::swap(new \Illuminate\Http\Client\Factory());
            Http::fake(['api.openai.com/v1/responses' => Http::response(['model' => 'test', 'output' => [['content' => [['type' => 'output_text', 'text' => json_encode($data)]]]]])]);
            $analysis = $this->apiAs($user)->post('/api/v1/driver/document-imports', ['file' => UploadedFile::fake()->image('note.png')])
                ->assertCreated()->assertJsonPath('data.status', 'analyzed');
            foreach ($missing as $kind) $analysis->assertJsonPath("data.extracted_data.line_items.0.$kind", $data['line_items'][0][$kind]);
            $id = $analysis->json('data.import_id');
            $preview = $this->apiAs($user)->postJson("/api/v1/driver/document-imports/$id/preview", $data)->assertOk();
            foreach ($missing as $kind) $this->assertContains($kind === 'pickup_address' ? 'Complete the collection address.' : 'Complete the delivery address.', $preview->json('data.rows.0.validation_warnings'));
            $this->apiAs($user)->postJson("/api/v1/driver/document-imports/$id/confirm", $data)->assertUnprocessable();
            // Omitted fields must not silently inherit the complete document address either.
            foreach ($missing as $kind) unset($data['line_items'][0][$kind]);
            $this->apiAs($user)->postJson("/api/v1/driver/document-imports/$id/confirm", $data)->assertUnprocessable();
        }
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_missing_collection_uses_reviewed_run_start_and_persists_the_same_location(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $start = \App\Models\Location::where('uuid', $draft['origin_location_id'])->firstOrFail();
        $start->update(['address_line_1' => 'Starting depot road']);
        $draft['line_items'][0]['pickup_address'] = [];
        $draft['line_items'][1]['pickup_address'] = array_fill_keys(array_keys($draft['pickup_address']), null);
        $draft['line_items'][2]['pickup_address']['address_line_1'] = 'Explicit collection road';
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()
            ->assertJsonPath('data.rows.0.collection_comparison', 'match')
            ->assertJsonPath('data.rows.1.collection_comparison', 'match')
            ->assertJsonPath('data.rows.2.collection_comparison', 'mismatch');
        $this->assertNotContains('Complete the collection address.', $preview->json('data.rows.0.validation_warnings'));
        $draft['review_token'] = $preview->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk();
        foreach (['TODAY', 'FUTURE'] as $ref) $this->assertSame($start->id, Shipment::where('merchant_order_ref', $ref)->firstOrFail()->pickup_location_id);
        $this->assertSame('Explicit collection road', Shipment::where('merchant_order_ref', 'OLD')->firstOrFail()->pickupLocation->address_line_1);
    }

    public function test_missing_collection_uses_a_scoped_draft_start_saved_during_confirmation(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $draftId = (string) Str::uuid();
        \Illuminate\Support\Facades\Cache::put("driver-trip-location:{$user->driver->id}:$draftId", array_merge($draft['pickup_address'], [
            'uuid' => $draftId, 'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'name' => 'Reviewed new starting point', 'address_line_1' => 'New starting road', 'latitude' => -26.2, 'longitude' => 28.2,
        ]), 3600);
        $draft['origin_location_id'] = $draftId;
        $draft['line_items'][0]['pickup_from_run_start'] = true;
        $draft['line_items'][0]['pickup_location_id'] = $draftId;
        $draft['line_items'][0]['pickup_address'] = [];
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()->assertJsonPath('data.rows.0.collection_comparison', 'match');
        $draft['review_token'] = $preview->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk();
        $shipment = Shipment::where('merchant_order_ref', 'TODAY')->firstOrFail();
        $this->assertSame($draftId, $shipment->pickupLocation->uuid);
        $this->assertSame('New starting road', $shipment->pickupLocation->address_line_1);
    }

    public function test_inherited_collection_follows_start_and_never_fills_missing_delivery_or_partial_collection(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $draft['line_items'][0]['pickup_from_run_start'] = true;
        $draft['line_items'][0]['pickup_location_id'] = (string) Str::uuid(); // Ignore a stale inherited ID, use scoped origin.
        $draft['line_items'][0]['pickup_address'] = ['address_line_1' => 'Stale inherited depot'];
        $draft['line_items'][0]['dropoff_address'] = [];
        $draft['line_items'][1]['pickup_address'] = ['city' => 'Partial extracted city'];
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()
            ->assertJsonPath('data.rows.0.collection_comparison', 'match');
        $this->assertContains('Complete the delivery address.', $preview->json('data.rows.0.validation_warnings'));
        $this->assertNotContains('Complete the collection address.', $preview->json('data.rows.0.validation_warnings'));
        $this->assertContains('Complete the collection address.', $preview->json('data.rows.1.validation_warnings'));
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertUnprocessable();
        unset($draft['origin_location_id']);
        $this->apiAs($user)->postJson("$url/preview", $draft)->assertUnprocessable();
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_saved_locations_with_partial_postal_fields_are_valid_and_compare_by_identity(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $attributes = ['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'address_line_1' => '', 'province' => '', 'name' => 'Selected depot', 'city' => 'Marikana', 'post_code' => '0284', 'country' => 'South Africa',
            'latitude' => -25.7, 'longitude' => 27.5];
        $start = \App\Models\Location::create($attributes);
        $delivery = \App\Models\Location::create(array_merge($attributes, ['name' => 'Selected delivery']));
        $draft = $this->draft();
        $draft['origin_location_id'] = $start->uuid;
        $draft['line_items'] = [$draft['line_items'][0]];
        $draft['line_items'][0]['pickup_location_id'] = $start->uuid;
        $draft['line_items'][0]['dropoff_location_id'] = $delivery->uuid;
        $draft['line_items'][0]['pickup_address'] = [];
        $draft['line_items'][0]['dropoff_address'] = [];
        $import = $this->import($user, $merchant);
        $url = "/api/v1/driver/document-imports/{$import->uuid}";
        $preview = $this->apiAs($user)->postJson("$url/preview", $draft)->assertOk()
            ->assertJsonPath('data.rows.0.collection_comparison', 'match')
            ->assertJsonPath('data.rows.0.validation_warnings', []);
        $draft['review_token'] = $preview->json('data.review_token');
        $this->apiAs($user)->postJson("$url/confirm", $draft)->assertOk();
        $shipment = Shipment::where('merchant_order_ref', 'TODAY')->firstOrFail();
        $this->assertSame($start->id, $shipment->pickup_location_id);
        $this->assertSame($delivery->id, $shipment->dropoff_location_id);
    }

    public function test_distinct_saved_collections_with_identical_partial_addresses_are_mismatches(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $attributes = ['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'address_line_1' => '', 'province' => '', 'country' => 'South Africa', 'name' => 'Depot', 'city' => 'Marikana', 'post_code' => '0284', 'latitude' => -25.7, 'longitude' => 27.5];
        $start = \App\Models\Location::create($attributes);
        $pickup = \App\Models\Location::create($attributes);
        $draft = $this->draft();
        $draft['origin_location_id'] = $start->uuid;
        $draft['line_items'][0]['pickup_location_id'] = $pickup->uuid;
        $import = $this->import($user, $merchant);
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/preview", $draft)->assertOk()
            ->assertJsonPath('data.rows.0.collection_comparison', 'mismatch');
    }

    public function test_saved_only_collection_search_never_geocodes_missing_locations(): void
    {
        [$user] = $this->createDriverContext();
        Http::fake();
        $this->apiAs($user)->postJson('/api/v1/driver/trip-locations/search', ['query' => 'Missing depot', 'saved_only' => true])
            ->assertOk()->assertJsonCount(0, 'data')->assertJsonPath('meta.next_page', null);
        Http::assertNothingSent();
    }

    public function test_driver_import_preserves_quantity_unit_and_uses_saved_collection(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $location = \App\Models\Location::create(array_merge($this->draft()['pickup_address'], [
            'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Saved collection',
            'address_line_1' => 'Saved Street', 'latitude' => -26.1, 'longitude' => 28.1,
        ]));
        $import = $this->import($user, $merchant);
        $draft = $this->draft();
        $draft['line_items'][0]['pickup_location_id'] = $location->uuid;
        $draft['line_items'][0]['dropoff_location_id'] = $location->uuid;
        $draft['line_items'][0]['dropoff_address'] = []; // Driver selection resolves a missing extracted address.
        $draft['line_items'][0]['pickup_address'] = $draft['pickup_address']; // Deliberately stale client address.
        $draft['line_items'][0]['quantity_unit'] = 'drums';
        $draft['line_items'][0]['type'] = 'DR';
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertOk();
        $shipment = Shipment::where('merchant_order_ref', 'TODAY')->firstOrFail();
        $this->assertSame($location->id, $shipment->pickup_location_id);
        $this->assertSame($location->id, $shipment->dropoff_location_id);
        $this->assertSame('drums', $shipment->metadata['delivery_note_items'][0]['quantity_unit']);
        $this->assertSame(2, $shipment->parcels()->count());
        $this->assertSame(['standard'], $shipment->parcels()->pluck('type')->unique()->values()->all());
    }

    public function test_collection_selection_rejects_unknown_or_other_merchant_locations_and_invalid_units(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        [, $otherMerchant] = $this->createDriverContext();
        $foreign = \App\Models\Location::create(array_merge($this->draft()['pickup_address'], ['account_id' => $otherMerchant->account_id, 'merchant_id' => $otherMerchant->id]));
        $import = $this->import($user, $merchant);
        $draft = $this->draft();
        foreach (['pickup_location_id', 'dropoff_location_id'] as $kind) {
            foreach ([$foreign->uuid, (string) Str::uuid()] as $uuid) {
                $draft['line_items'][0][$kind] = $uuid;
                $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/preview", $draft)->assertStatus(422);
                $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertStatus(422);
            }
            unset($draft['line_items'][0][$kind]);
        }
        $draft['line_items'][0]['quantity_unit'] = 'unsupported';
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertStatus(422);
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_liters_preserve_decimal_volume_without_expanding_parcels(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $draft = $this->draft();
        $draft['line_items'][0]['quantity_unit'] = 'liters';
        $draft['line_items'][0]['quantity'] = 1250.5;
        $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)->assertOk();
        $shipment = Shipment::where('merchant_order_ref', 'TODAY')->firstOrFail();
        $this->assertSame(1250.5, $shipment->metadata['delivery_note_items'][0]['quantity']);
        $this->assertSame('liters', $shipment->metadata['delivery_note_items'][0]['quantity_unit']);
        $this->assertSame(1, $shipment->parcels()->count());
    }

    public function test_liters_require_positive_bounded_volume_and_packaging_keeps_integer_limits(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        foreach (['liters' => [null, 0, -1, 1000001], 'boxes' => [1.5, 101]] as $unit => $quantities) {
            foreach ($quantities as $quantity) {
                $draft = $this->draft();
                $draft['line_items'][0]['quantity_unit'] = $unit;
                $draft['line_items'][0]['quantity'] = $quantity;
                $this->apiAs($user)->postJson("/api/v1/driver/document-imports/{$import->uuid}/confirm", $draft)
                    ->assertUnprocessable()->assertJsonValidationErrors('line_items.0.quantity');
            }
        }
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_address_search_returns_scoped_draft_choices_without_saving_locations(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        config(['services.google_maps.geocoding_api_key' => 'test']);
        Http::fake(['maps.googleapis.com/*' => Http::response(['status' => 'OK', 'results' => [['formatted_address' => '10 Example Street, Johannesburg', 'place_id' => 'example', 'address_components' => [], 'geometry' => ['location' => ['lat' => -26.1, 'lng' => 28.1]]]]])]);
        $response = $this->apiAs($user)->postJson('/api/v1/driver/trip-locations/search', ['query' => '10 Example Street'])->assertOk()->assertJsonCount(1, 'data');
        $this->assertDatabaseCount('locations', 0);
        [$other] = $this->createDriverContext($merchant);
        $import = $this->import($other, $merchant);
        $draft = $this->draft(); $draft['origin_location_id'] = $response->json('data.0.location_id');
        $this->apiAs($other)->postJson("/api/v1/driver/document-imports/{$import->uuid}/preview", $draft)->assertStatus(422);
    }

    public function test_driver_can_fill_missing_final_destination_without_changing_run_lifecycle(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $draft = $this->plannedDraft($user, $merchant);
        $location = \App\Models\Location::where('uuid', $draft['destination_location_id'])->firstOrFail();
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'in_progress', 'started_at' => now()->subHour(), 'origin_location_id' => $location->id]);
        $started = $run->started_at->toIso8601String();
        $this->apiAs($user)->getJson('/api/v1/driver/dashboard')->assertOk()->assertJsonPath('data.current_run.destination_location_id', null);
        $url = "/api/v1/driver/runs/{$run->uuid}/final-destination";
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $location->uuid])->assertOk();
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $location->uuid])->assertOk();
        $this->assertSame($location->id, $run->fresh()->destination_location_id);
        $this->assertSame('in_progress', $run->fresh()->status);
        $this->assertSame($started, $run->fresh()->started_at->toIso8601String());
        $this->apiAs($user)->getJson('/api/v1/driver/dashboard')->assertOk()->assertJsonPath('data.current_run.destination_location_id', $location->uuid)->assertJsonPath('data.planned_delivery_stops.0.kind', 'Planned end');
        $otherLocation = $location->replicate(['uuid']); $otherLocation->save();
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $otherLocation->uuid])->assertStatus(409);
        $this->assertSame($location->id, $run->fresh()->destination_location_id);
    }

    public function test_final_destination_rejects_unowned_closed_runs_and_unmapped_locations(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        [$other] = $this->createDriverContext($merchant);
        $draft = $this->plannedDraft($user, $merchant);
        $location = \App\Models\Location::where('uuid', $draft['destination_location_id'])->firstOrFail();
        $run = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'driver_id' => $user->driver->id, 'status' => 'draft']);
        $url = "/api/v1/driver/runs/{$run->uuid}/final-destination";
        $this->apiAs($other)->patchJson($url, ['destination_location_id' => $location->uuid])->assertNotFound();
        $location->update(['latitude' => null]);
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $location->uuid])->assertStatus(422);
        $location->update(['latitude' => -26.1]);
        [$foreignUser, $foreignMerchant] = $this->createDriverContext();
        $foreign = $this->plannedDraft($foreignUser, $foreignMerchant);
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $foreign['destination_location_id']])->assertStatus(422);
        $run->update(['status' => 'completed']);
        $this->apiAs($user)->patchJson($url, ['destination_location_id' => $location->uuid])->assertNotFound();
        $this->assertNull($run->fresh()->destination_location_id);
    }

    public function test_async_upload_queues_once_and_status_is_owned(): void
    {
        Storage::fake('local');
        config()->set('filesystems.default', 'local');
        \Illuminate\Support\Facades\Queue::fake();
        [$user, $merchant] = $this->createDriverContext();
        $uuid = (string) Str::uuid();
        $body = ['async' => '1', 'import_id' => $uuid, 'file' => UploadedFile::fake()->image('note.png')];
        $this->apiAs($user)->post('/api/v1/driver/document-imports', $body)->assertStatus(202)
            ->assertJsonPath('data.import_id', $uuid)->assertJsonPath('data.status', 'queued');
        $this->apiAs($user)->post('/api/v1/driver/document-imports', $body)->assertStatus(202);
        $this->assertDatabaseCount('delivery_note_imports', 1);
        \Illuminate\Support\Facades\Queue::assertPushed(\App\Jobs\AnalyzeDeliveryNote::class, 1);
        $this->apiAs($user)->getJson('/api/v1/driver/document-imports/'.$uuid)->assertOk()
            ->assertJsonPath('data.status', 'queued')->assertJsonPath('data.poll_after_ms', 3200);
        [$other] = $this->createDriverContext();
        $this->apiAs($other)->getJson('/api/v1/driver/document-imports/'.$uuid)->assertNotFound();
        $this->apiAs($other)->post('/api/v1/driver/document-imports', $body)->assertNotFound();
    }

    public function test_async_worker_extracts_saved_file_once_and_exposes_result(): void
    {
        Storage::fake('local');
        config()->set('filesystems.default', 'local');
        \Illuminate\Support\Facades\Queue::fake();
        [$user, $merchant] = $this->createDriverContext();
        $uuid = (string) Str::uuid();
        $this->apiAs($user)->post('/api/v1/driver/document-imports', ['async' => '1', 'import_id' => $uuid, 'file' => UploadedFile::fake()->image('note.png')])->assertStatus(202);
        $import = DeliveryNoteImport::where('uuid', $uuid)->firstOrFail();
        $this->mock(\App\Services\Integrations\OpenAIService::class)->shouldReceive('extractDeliveryNote')->once()
            ->withArgs(fn ($file) => is_file($file->getRealPath()) && $file->getClientOriginalName() === 'note.png')
            ->andReturn(['model' => 'test-model', 'data' => $this->draft()]);
        $job = new \App\Jobs\AnalyzeDeliveryNote($import->id);
        $service = app(\App\Services\DeliveryNoteImportService::class);
        $job->handle($service);
        $job->handle($service);
        $this->apiAs($user)->getJson('/api/v1/driver/document-imports/'.$uuid)->assertOk()
            ->assertJsonPath('data.status', 'analyzed')->assertJsonPath('data.failure_message', null)
            ->assertJsonPath('data.extracted_data.line_items.0.merchant_order_ref', $this->draft()['line_items'][0]['merchant_order_ref']);
        $this->assertDatabaseCount('shipments', 0);
        $this->assertNull($job->connection);
        $this->assertNull($job->queue);
        $this->assertTrue($job->afterCommit);
        foreach (['database', 'redis', 'beanstalkd'] as $connection) {
            $this->assertGreaterThan($job->timeout, config("queue.connections.{$connection}.retry_after"));
        }
    }

    public function test_async_worker_failure_is_available_through_status_and_cannot_overwrite_success(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $import->update(['status' => 'queued']);
        $job = new \App\Jobs\AnalyzeDeliveryNote($import->id);
        $job->failed(new \RuntimeException('The reading service timed out.'));
        $this->apiAs($user)->getJson('/api/v1/driver/document-imports/'.$import->uuid)->assertOk()
            ->assertJsonPath('data.status', 'failed')->assertJsonPath('data.failure_message', 'The reading service timed out.');
        $import->update(['status' => 'analyzed', 'failure_message' => null]);
        $job->failed(new \RuntimeException('Late failure'));
        $this->assertSame('analyzed', $import->fresh()->status);
    }

    public function test_stalled_async_import_expires_instead_of_polling_forever(): void
    {
        [$user, $merchant] = $this->createDriverContext();
        $import = $this->import($user, $merchant);
        $import->update(['status' => 'queued']);
        $this->travel(16)->minutes();
        $this->apiAs($user)->getJson('/api/v1/driver/document-imports/'.$import->uuid)->assertOk()
            ->assertJsonPath('data.status', 'failed')
            ->assertJsonPath('data.failure_message', 'Document processing timed out. Please upload the document again.');
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_shared_analysis_endpoints_support_drivers_and_authorized_admins(): void
    {
        Storage::fake('local');
        config()->set('filesystems.default', 'local');
        \Illuminate\Support\Facades\Queue::fake();
        [$driver, $merchant] = $this->createDriverContext();
        $driverId = (string) Str::uuid();
        $this->apiAs($driver)->post('/api/v1/delivery-note-imports/analyze', ['import_id' => $driverId, 'file' => UploadedFile::fake()->image('driver.png')])
            ->assertStatus(202)->assertJsonPath('data.status', 'queued');
        $this->apiAs($driver)->getJson('/api/v1/delivery-note-imports/'.$driverId.'/status')->assertOk();
        $admin = User::findOrFail($merchant->owner_user_id);
        $this->apiAs($admin)->withHeader('X-Merchant-Id', $merchant->uuid)
            ->getJson('/api/v1/delivery-note-imports/'.$driverId.'/status')->assertOk();
        $adminId = (string) Str::uuid();
        $this->apiAs($admin)->post('/api/v1/delivery-note-imports/analyze', ['import_id' => $adminId, 'file' => UploadedFile::fake()->image('admin.png')])
            ->assertStatus(202)->assertJsonPath('data.import_id', $adminId);
        $this->apiAs($driver)->getJson('/api/v1/delivery-note-imports/'.$adminId.'/status')->assertNotFound();
        [$outsider, $foreign] = $this->createDriverContext();
        $this->apiAs(User::findOrFail($foreign->owner_user_id))->withHeader('X-Merchant-Id', $foreign->uuid)
            ->getJson('/api/v1/delivery-note-imports/'.$adminId.'/status')->assertNotFound();
        $this->assertDatabaseCount('shipments', 0);
    }

    public function test_shared_analysis_enforces_admin_permissions_environment_and_id_context(): void
    {
        Storage::fake('local');
        config()->set('filesystems.default', 'local');
        \Illuminate\Support\Facades\Queue::fake();
        [$driver, $merchant] = $this->createDriverContext();
        $admin = User::findOrFail($merchant->owner_user_id);
        $environment = \App\Models\MerchantEnvironment::create(['merchant_id' => $merchant->id, 'name' => 'Test', 'color' => '#123456', 'url' => 'https://example.test', 'token' => 'analysis-test-token', 'token_hash' => hash('sha256', 'analysis-test-token')]);
        $uuid = (string) Str::uuid();
        $body = ['import_id' => $uuid, 'environment_id' => $environment->uuid, 'file' => UploadedFile::fake()->image('admin.png')];
        $this->apiAs($admin)->withHeader('X-Merchant-Id', $merchant->uuid)->post('/api/v1/delivery-note-imports/analyze', $body)->assertStatus(202);
        $this->assertDatabaseHas('delivery_note_imports', ['uuid' => $uuid, 'environment_id' => $environment->id]);
        $this->apiAs($admin)->getJson('/api/v1/delivery-note-imports/'.$uuid.'/status?environment_id='.$environment->uuid)->assertOk();
        $body['environment_id'] = null;
        $this->apiAs($admin)->post('/api/v1/delivery-note-imports/analyze', $body)->assertStatus(409);
        $viewer = User::withoutEvents(fn () => User::factory()->create(['uuid' => (string) Str::uuid(), 'role' => 'user', 'account_id' => $merchant->account_id]));
        $merchant->users()->attach($viewer->id, ['role' => 'read_only']);
        $this->apiAs($viewer)->getJson('/api/v1/delivery-note-imports/'.$uuid.'/status')->assertOk();
        $body['import_id'] = (string) Str::uuid();
        $this->apiAs($viewer)->post('/api/v1/delivery-note-imports/analyze', $body)->assertForbidden();
        $this->assertDatabaseCount('delivery_note_imports', 1);
    }

    private function createDriverContext(?Merchant $merchant = null, ?string $email = null): array
    {
        if (! $merchant) {
            $owner = User::withoutEvents(fn () => User::factory()->create([
                'uuid' => (string) Str::uuid(),
                'email' => fake()->unique()->safeEmail(),
                'role' => 'user',
            ]));

            $account = Account::create(['owner_user_id' => $owner->id]);
            $owner->forceFill(['account_id' => $account->id])->save();

            $merchant = Merchant::create([
                'account_id' => $account->id,
                'owner_user_id' => $owner->id,
                'name' => fake()->company(),
                'legal_name' => fake()->company().' LLC',
                'status' => 'active',
                'billing_email' => fake()->safeEmail(),
                'default_webhook_url' => fake()->url(),
                'timezone' => 'UTC',
                'operating_countries' => ['US'],
            ]);
            $merchant->users()->attach($owner->id, ['role' => 'owner']);
        }

        $driverUser = User::withoutEvents(fn () => User::factory()->create([
            'uuid' => (string) Str::uuid(),
            'email' => $email ?? fake()->unique()->safeEmail(),
            'role' => 'driver',
            'account_id' => $merchant->account_id,
        ]));

        Driver::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'user_id' => $driverUser->id,
            'is_active' => true,
        ]);

        return [$driverUser->fresh('driver'), $merchant];
    }
}
