<?php

namespace Tests\Feature;

use App\Jobs\SendWebhookDeliveryJob;
use App\Models\Merchant;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class WebhookDeliveryTest extends TestCase
{
    use RefreshDatabase;

    public function test_webhook_delivery_retries(): void
    {
        Http::fake([
            '*' => Http::response('fail', 500),
        ]);

        $merchant = Merchant::factory()->create();
        $subscription = WebhookSubscription::create([
            'merchant_id' => $merchant->id,
            'url' => 'https://example.com/webhook',
            'secret' => 'secret',
            'event_types' => ['tracking.updated'],
            'status' => 'active',
        ]);

        $delivery = WebhookDelivery::create([
            'webhook_subscription_id' => $subscription->id,
            'merchant_id' => $merchant->id,
            'event_type' => 'tracking.updated',
            'payload' => ['message' => 'test'],
            'status' => 'pending',
            'next_attempt_at' => now(),
        ]);

        SendWebhookDeliveryJob::dispatchSync($delivery->id);

        $delivery->refresh();
        $this->assertGreaterThanOrEqual(1, $delivery->attempts);
        $this->assertContains($delivery->status, ['attempted', 'failed']);
    }
}
