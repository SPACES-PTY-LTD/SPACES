<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShipmentDeliveryNoteUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_delivery_note_number_can_be_updated_after_draft_before_invoicing(): void
    {
        [$user, $shipment] = $this->createShipmentContext([
            'status' => 'booked',
            'delivery_note_number' => 'DN-OLD',
            'invoiced_at' => null,
        ]);

        $response = $this->apiAs($user)->patchJson("/api/v1/shipments/{$shipment->uuid}/delivery-note-number", [
            'delivery_note_number' => 'DN-NEW',
        ]);

        $response->assertOk()
            ->assertJsonPath('data.delivery_note_number', 'DN-NEW');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipment->uuid,
            'delivery_note_number' => 'DN-NEW',
        ]);
    }

    public function test_delivery_note_number_cannot_be_updated_after_invoicing(): void
    {
        [$user, $shipment] = $this->createShipmentContext([
            'status' => 'booked',
            'delivery_note_number' => 'DN-OLD',
            'invoice_number' => 'INV-DN',
            'invoiced_at' => now(),
        ]);

        $response = $this->apiAs($user)->patchJson("/api/v1/shipments/{$shipment->uuid}/delivery-note-number", [
            'delivery_note_number' => 'DN-NEW',
        ]);

        $response->assertConflict()
            ->assertJsonPath('error.code', 'SHIPMENT_INVOICED');

        $this->assertDatabaseHas('shipments', [
            'uuid' => $shipment->uuid,
            'delivery_note_number' => 'DN-OLD',
        ]);
    }

    private function createShipmentContext(array $shipmentAttributes): array
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $shipment = Shipment::create(array_merge([
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-DN-'.uniqid(),
            'status' => 'draft',
        ], $shipmentAttributes));

        return [$user, $shipment];
    }

    private function apiAs(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('test-suite')->plainTextToken);
    }
}
