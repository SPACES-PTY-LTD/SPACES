<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\DeliveryNoteImport;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ShipmentService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminRunImportTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id, 'account_id' => $account->id, 'timezone' => 'Africa/Johannesburg']);
        $merchant->users()->attach($user->id, ['role' => 'owner']);
        $import = DeliveryNoteImport::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'uploaded_by_user_id' => $user->id,
            'status' => 'analyzed', 'disk' => 'local', 'path' => 'note.png', 'original_name' => 'note.png', 'mime_type' => 'image/png', 'size_bytes' => 10]);
        $origin = $this->location($merchant, 'Depot');
        $end = $this->location($merchant, 'End');
        $pickup = $this->location($merchant, 'Other collection');
        $payload = ['merchant_id' => $merchant->uuid, 'origin_location_id' => $origin->uuid, 'destination_location_id' => $end->uuid,
            'delivery_note_number' => 'DN-123', 'line_items' => [
                ['merchant_order_ref' => 'ORDER-1', 'description' => 'Boxes', 'quantity' => 2, 'quantity_unit' => 'boxes', 'collection_date' => '2026-10-13', 'pickup_location_id' => $origin->uuid, 'dropoff_location_id' => $end->uuid, 'pickup_instructions' => 'Ask for dispatch'],
                ['merchant_order_ref' => 'ORDER-2', 'description' => 'Bulk', 'quantity' => 1.25, 'quantity_unit' => 'tonnes', 'collection_date' => '2026-10-14', 'pickup_location_id' => $pickup->uuid, 'dropoff_location_id' => $end->uuid],
            ]];
        return [$user, $merchant, $import, $payload];
    }

    private function location(Merchant $merchant, string $name): Location
    {
        return Location::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => $name,
            'address_line_1' => '1 Main Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'country' => 'ZA', 'latitude' => -26.2, 'longitude' => 28.1]);
    }

    private function apiAs(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test')->plainTextToken);
    }

    public function test_preview_and_atomic_unassigned_confirmation_are_retry_safe(): void
    {
        [$user, $merchant, $import, $payload] = $this->context();
        $url = "/api/v1/delivery-note-imports/{$import->uuid}";
        $this->apiAs($user)->postJson("$url/preview", $payload)->assertOk()->assertJsonPath('data.can_confirm', true)->assertJsonPath('data.rows.1.collection_comparison', 'mismatch');
        $this->assertDatabaseCount('runs', 0);
        $response = $this->apiAs($user)->postJson("$url/confirm", $payload)->assertOk()->assertJsonCount(2, 'data.shipment_ids')->assertJsonPath('data.run.status', 'draft');
        $run = Run::where('uuid', $response->json('data.run_id'))->firstOrFail();
        $this->assertNull($run->driver_id); $this->assertNull($run->vehicle_id); $this->assertNull($run->started_at);
        $this->assertDatabaseCount('shipment_parcels', 3);
        $bulk = Shipment::where('merchant_order_ref', 'ORDER-2')->firstOrFail();
        $this->assertEquals(1250, ($bulk->parcels()->first()->weight ?? $bulk->parcels()->first()->weight_kg));
        $this->assertSame('tonnes', $bulk->metadata['delivery_note_items'][0]['quantity_unit']);
        $this->assertSame('2026-10-13', $bulk->collection_date->utc()->toDateString());
        $this->assertDatabaseHas('shipments', ['merchant_order_ref' => 'ORDER-1', 'pickup_instructions' => 'Ask for dispatch']);
        $this->apiAs($user)->postJson("$url/confirm", $payload)->assertOk()->assertJsonPath('data.already_confirmed', true)->assertJsonPath('data.run_id', $run->uuid);
        $this->assertDatabaseCount('runs', 1); $this->assertDatabaseCount('shipments', 2);
    }

    public function test_missing_locations_quantities_and_duplicate_references_block_confirmation(): void
    {
        [$user, , $import, $payload] = $this->context();
        $payload['line_items'][0]['pickup_location_id'] = null;
        $payload['line_items'][0]['quantity'] = 1.5;
        $payload['line_items'][1]['merchant_order_ref'] = 'ORDER-1';
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/preview", $payload)->assertOk()->assertJsonPath('data.can_confirm', false);
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertUnprocessable();
        $this->assertDatabaseCount('runs', 0); $this->assertDatabaseCount('shipments', 0);
        $this->assertSame('analyzed', $import->fresh()->status);
    }

    public function test_excluded_and_existing_rows_are_skipped_without_moving_shipments(): void
    {
        [$user, $merchant, $import, $payload] = $this->context();
        $existing = Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'merchant_order_ref' => 'ORDER-2', 'status' => 'booked']);
        $payload['line_items'][] = ['excluded' => true, 'merchant_order_ref' => 'IGNORE', 'collection_date' => 'invalid', 'quantity' => 'not-a-number'];
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/preview", $payload)->assertOk()->assertJsonPath('data.rows.1.eligibility', 'existing');
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertOk()->assertJsonCount(1, 'data.shipment_ids');
        $this->assertDatabaseMissing('run_shipments', ['shipment_id' => $existing->id]);
    }

    public function test_all_excluded_rows_and_unroutable_endpoints_do_not_create_empty_runs(): void
    {
        [$user, , $import, $payload] = $this->context();
        foreach ($payload['line_items'] as &$row) $row['excluded'] = true;
        unset($row);
        Location::where('uuid', $payload['origin_location_id'])->update(['latitude' => null]);
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertUnprocessable();
        $this->assertDatabaseCount('runs', 0);
    }

    public function test_cross_merchant_and_environment_contexts_are_rejected(): void
    {
        [$user, $merchant, $import, $payload] = $this->context();
        [$other, $otherMerchant] = $this->context();
        $this->apiAs($other)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", [...$payload, 'merchant_id' => $otherMerchant->uuid])->assertNotFound();
        $payload['line_items'][0]['dropoff_location_id'] = $this->location($otherMerchant, 'Foreign')->uuid;
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertUnprocessable();
        $environment = MerchantEnvironment::create(['merchant_id' => $merchant->id, 'name' => 'Test', 'color' => '#000000', 'url' => 'https://example.test', 'token_hash' => hash('sha256', 'test')]);
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/preview", [...$payload, 'environment_id' => $environment->uuid])->assertNotFound();
        $user->update(['role' => 'driver']);
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/preview", $payload)->assertForbidden();
    }

    public function test_resource_viewers_cannot_preview_or_confirm(): void
    {
        [$user, $merchant, $import, $payload] = $this->context();
        $viewer = User::factory()->create(['account_id' => $merchant->account_id]);
        $merchant->users()->attach($viewer->id, ['role' => 'read_only']);
        foreach (['preview', 'confirm'] as $action) $this->apiAs($viewer)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/$action", $payload)->assertForbidden();
        $this->assertDatabaseCount('runs', 0);
    }

    public function test_environment_scoped_imports_keep_run_and_shipments_in_that_environment(): void
    {
        [$user, $merchant, $import, $payload] = $this->context();
        $environment = MerchantEnvironment::create(['merchant_id' => $merchant->id, 'name' => 'Live', 'color' => '#ffffff', 'url' => 'https://example.test', 'token_hash' => hash('sha256', 'live')]);
        $import->update(['environment_id' => $environment->id]);
        $payload['environment_id'] = $environment->uuid;
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertOk();
        $this->assertDatabaseHas('runs', ['environment_id' => $environment->id]);
        $this->assertSame([$environment->id], Shipment::pluck('environment_id')->unique()->values()->all());
    }

    public function test_invalid_optional_assignment_rolls_back_and_parcel_limit_is_enforced(): void
    {
        [$user, , $import, $payload] = $this->context();
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", [...$payload, 'vehicle_id' => (string) \Illuminate\Support\Str::uuid()])->assertUnprocessable();
        $row = $payload['line_items'][0]; $payload['line_items'] = [];
        for ($i = 0; $i < 6; $i++) $payload['line_items'][] = [...$row, 'merchant_order_ref' => "MANY-$i", 'quantity' => 100];
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/preview", $payload)->assertOk()->assertJsonPath('data.can_confirm', false);
        $this->assertDatabaseCount('runs', 0);
    }

    public function test_confirmation_rolls_back_run_and_first_shipment_when_second_creation_fails(): void
    {
        [$user, , $import, $payload] = $this->context();
        $real = app(ShipmentService::class); $count = 0;
        $this->mock(ShipmentService::class, function ($mock) use ($real, &$count) {
            $mock->shouldReceive('createShipment')->twice()->andReturnUsing(function ($data) use ($real, &$count) {
                if (++$count === 2) throw \Illuminate\Validation\ValidationException::withMessages(['line_items' => 'Injected failure']);
                return $real->createShipment($data);
            });
        });
        $this->apiAs($user)->postJson("/api/v1/delivery-note-imports/{$import->uuid}/confirm", $payload)->assertUnprocessable();
        $this->assertDatabaseCount('runs', 0); $this->assertDatabaseCount('shipments', 0); $this->assertDatabaseCount('shipment_parcels', 0);
        $this->assertSame('analyzed', $import->fresh()->status);
    }
}
