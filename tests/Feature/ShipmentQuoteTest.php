<?php

namespace Tests\Feature;

use App\Jobs\QuoteRequestJob;
use App\Models\Account;
use App\Models\Merchant;
use App\Models\Location;
use App\Models\Run;
use App\Models\User;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ShipmentQuoteTest extends TestCase
{
    use RefreshDatabase;

    public function test_shipment_create_and_list_pagination(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $create = $this->actingAs($user)->postJson('/api/v1/shipments', [
            'merchant_uuid' => $merchant->uuid,
            'merchant_order_ref' => 'ORDER-1',
            'delivery_note_number' => 'DN-100',
            'invoice_number' => 'INV-100',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ]);

        $create->assertStatus(201)
            ->assertJsonPath('data.delivery_note_number', 'DN-100')
            ->assertJsonPath('data.invoice_number', 'INV-100');

        $list = $this->actingAs($user)->getJson('/api/v1/shipments?per_page=1');
        $list->assertStatus(200)
            ->assertJsonPath('data.0.delivery_note_number', 'DN-100')
            ->assertJsonPath('data.0.invoice_number', 'INV-100');
        $this->assertEquals(1, $list->json('meta.per_page'));
    }

    public function test_shipment_update_sets_invoiced_at_to_now_when_invoice_number_changes_without_timestamp(): void
    {
        Carbon::setTestNow('2026-02-28 15:00:00');

        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $create = $this->actingAs($user)->postJson('/api/v1/shipments', [
            'merchant_uuid' => $merchant->uuid,
            'merchant_order_ref' => 'ORDER-2',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ])->assertStatus(201);

        $shipmentId = $create->json('data.shipment_id');

        $update = $this->actingAs($user)->patchJson("/api/v1/shipments/{$shipmentId}", [
            'invoice_number' => 'INV-200',
        ]);

        $update->assertOk()
            ->assertJsonPath('data.invoice_number', 'INV-200')
            ->assertJsonPath('data.invoiced_at', '2026-02-28T15:00:00+00:00');

        $show = $this->actingAs($user)->getJson("/api/v1/shipments/{$shipmentId}");
        $show->assertOk()
            ->assertJsonPath('data.invoice_number', 'INV-200')
            ->assertJsonPath('data.invoiced_at', '2026-02-28T15:00:00+00:00');

        Carbon::setTestNow();
    }

    public function test_shipment_show_returns_stops_from_vehicle_events(): void
    {
        $user = User::factory()->create();
        $account = Account::create(['owner_user_id' => $user->id]);
        $user->forceFill(['account_id' => $account->id])->save();

        $merchant = Merchant::factory()->create([
            'owner_user_id' => $user->id,
            'account_id' => $account->id,
        ]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $create = $this->actingAs($user)->postJson('/api/v1/shipments', [
            'merchant_uuid' => $merchant->uuid,
            'merchant_order_ref' => 'ORDER-3',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ])->assertStatus(201);

        $shipmentId = $create->json('data.shipment_id');

        $shipment = \App\Models\Shipment::query()->where('uuid', $shipmentId)->firstOrFail();
        $vehicle = Vehicle::create([
            'account_id' => $account->id,
            'plate_number' => 'CA12345',
            'is_active' => true,
        ]);
        $location = Location::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'name' => 'Stop A',
            'city' => 'Cape Town',
            'province' => 'Western Cape',
        ]);
        $run = Run::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'status' => Run::STATUS_IN_PROGRESS,
        ]);

        VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'shipment_id' => $shipment->id,
            'location_id' => $location->id,
            'run_id' => $run->id,
            'event_type' => VehicleActivity::EVENT_ENTERED_LOCATION,
            'occurred_at' => '2026-02-28 08:00:00',
        ]);

        VehicleActivity::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'vehicle_id' => $vehicle->id,
            'shipment_id' => $shipment->id,
            'event_type' => VehicleActivity::EVENT_SHIPMENT_DELIVERY,
            'occurred_at' => '2026-02-28 09:00:00',
        ]);

        $show = $this->actingAs($user)->getJson("/api/v1/shipments/{$shipmentId}");

        $show->assertOk()
            ->assertJsonCount(2, 'data.stops')
            ->assertJsonPath('data.stops.0.event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
            ->assertJsonPath('data.stops.1.event_type', VehicleActivity::EVENT_SHIPMENT_DELIVERY);
    }

    public function test_shipment_list_can_filter_invoiced_shipments(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $invoiced = $this->actingAs($user)->postJson('/api/v1/shipments', [
            'merchant_uuid' => $merchant->uuid,
            'merchant_order_ref' => 'ORDER-INV',
            'invoice_number' => 'INV-300',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ])->assertStatus(201);

        $uninvoiced = $this->actingAs($user)->postJson('/api/v1/shipments', [
            'merchant_uuid' => $merchant->uuid,
            'merchant_order_ref' => 'ORDER-NO-INV',
            'pickup_address' => ['name' => 'C'],
            'dropoff_address' => ['name' => 'D'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ])->assertStatus(201);

        $response = $this->actingAs($user)->getJson('/api/v1/shipments?invoiced=true');

        $response->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.shipment_id', $invoiced->json('data.shipment_id'))
            ->assertJsonMissing(['shipment_id' => $uninvoiced->json('data.shipment_id')]);
    }

    public function test_quote_request_queues_job(): void
    {
        Queue::fake();

        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $response = $this->actingAs($user)->postJson('/api/v1/quotes', [
            'merchant_uuid' => $merchant->uuid,
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
            'parcels' => [[
                'weight' => 1,
                'weight_measurement' => 'kg',
                'length_cm' => 10,
                'width_cm' => 10,
                'height_cm' => 10,
            ]],
        ]);

        $response->assertStatus(202);
        Queue::assertPushed(QuoteRequestJob::class);
    }
}
