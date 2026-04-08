<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class ShipmentInvoiceNumberUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_invoice_number_can_be_set_after_draft_when_delivery_note_exists(): void
    {
        Carbon::setTestNow('2026-04-08 12:00:00');
        [$user, $shipment] = $this->createShipmentContext([
            'status' => 'booked',
            'delivery_note_number' => 'DN-100',
            'invoice_number' => null,
            'invoiced_at' => null,
        ]);

        $response = $this->apiAs($user)->patchJson("/api/v1/shipments/{$shipment->uuid}/invoice-number", [
            'invoice_number' => 'INV-100',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.invoice_number', 'INV-100')
            ->assertJsonPath('data.invoiced_at', '2026-04-08T12:00:00+00:00');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipment->uuid,
            'invoice_number' => 'INV-100',
            'invoiced_at' => '2026-04-08 12:00:00',
        ]);
        Carbon::setTestNow();
    }

    public function test_invoice_number_can_be_updated_after_invoicing_and_preserves_invoiced_at(): void
    {
        $invoicedAt = Carbon::parse('2026-04-07 09:30:00');
        Carbon::setTestNow('2026-04-08 12:00:00');
        [$user, $shipment] = $this->createShipmentContext([
            'status' => 'booked',
            'delivery_note_number' => 'DN-200',
            'invoice_number' => 'INV-OLD',
            'invoiced_at' => $invoicedAt,
        ]);

        $response = $this->apiAs($user)->patchJson("/api/v1/shipments/{$shipment->uuid}/invoice-number", [
            'invoice_number' => 'INV-NEW',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.invoice_number', 'INV-NEW')
            ->assertJsonPath('data.invoiced_at', '2026-04-07T09:30:00+00:00');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipment->uuid,
            'invoice_number' => 'INV-NEW',
            'invoiced_at' => '2026-04-07 09:30:00',
        ]);
        Carbon::setTestNow();
    }

    public function test_invoice_number_requires_delivery_note_number(): void
    {
        [$user, $shipment] = $this->createShipmentContext([
            'status' => 'booked',
            'delivery_note_number' => '',
            'invoice_number' => null,
            'invoiced_at' => null,
        ]);

        $response = $this->apiAs($user)->patchJson("/api/v1/shipments/{$shipment->uuid}/invoice-number", [
            'invoice_number' => 'INV-100',
        ]);

        $response->assertUnprocessable()
            ->assertJsonPath('error.code', 'SHIPMENT_DELIVERY_NOTE_REQUIRED')
            ->assertJsonPath('error.message', 'Delivery note number is required before updating the invoice number.');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipment->uuid,
            'invoice_number' => null,
            'invoiced_at' => null,
        ]);
    }

    private function createShipmentContext(array $shipmentAttributes): array
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $shipment = Shipment::create(array_merge([
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-INV-'.uniqid(),
            'status' => 'draft',
        ], $shipmentAttributes));

        return [$user, $shipment];
    }

    private function apiAs(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }
}
