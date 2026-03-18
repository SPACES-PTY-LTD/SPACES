<?php

namespace Tests\Feature;

use App\Models\Merchant;
use App\Models\Quote;
use App\Models\QuoteOption;
use App\Models\Shipment;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BookingIdempotencyTest extends TestCase
{
    use RefreshDatabase;

    public function test_booking_idempotency(): void
    {
        $user = User::factory()->create();
        $merchant = Merchant::factory()->create(['owner_user_id' => $user->id]);
        $merchant->users()->attach($user->id, ['role' => 'owner']);

        $shipment = Shipment::create([
            'merchant_id' => $merchant->id,
            'merchant_order_ref' => 'ORDER-BOOK',
            'status' => 'draft',
            'pickup_address' => ['name' => 'A'],
            'dropoff_address' => ['name' => 'B'],
        ]);

        $quote = Quote::create([
            'merchant_id' => $merchant->id,
            'shipment_id' => $shipment->id,
            'status' => 'created',
            'requested_at' => now(),
        ]);

        $option = QuoteOption::create([
            'quote_id' => $quote->id,
            'carrier_code' => 'dummy',
            'service_code' => 'same_day',
            'currency' => 'ZAR',
            'amount' => 100,
            'total_amount' => 100,
        ]);

        $payload = ['quote_option_uuid' => $option->uuid];
        $first = $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'idem-1')
            ->postJson("/api/v1/shipments/{$shipment->uuid}/book", $payload);

        $first->assertStatus(202);

        $second = $this->actingAs($user)
            ->withHeader('Idempotency-Key', 'idem-1')
            ->postJson("/api/v1/shipments/{$shipment->uuid}/book", $payload);

        $second->assertStatus(202);
        $this->assertEquals($first->getContent(), $second->getContent());
    }
}
