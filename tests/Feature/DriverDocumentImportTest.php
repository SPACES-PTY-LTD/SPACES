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
                ['merchant_order_ref' => 'TODAY', 'description' => 'Boxes', 'quantity' => 2],
                ['merchant_order_ref' => 'FUTURE', 'description' => 'Box', 'collection_date' => '2026-09-16'],
                ['merchant_order_ref' => 'OLD', 'description' => 'Box', 'collection_date' => '2026-09-14'],
            ]];
    }

    private function import($user, $merchant, $run = null): DeliveryNoteImport
    {
        return DeliveryNoteImport::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'run_id' => $run?->id, 'uploaded_by_user_id' => $user->id, 'status' => 'analyzed', 'disk' => 'local',
            'path' => 'test.png', 'original_name' => 'test.png', 'mime_type' => 'image/png', 'size_bytes' => 10, 'extracted_data' => $this->draft()]);
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
        $draft['pickup_address'] = [];
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
