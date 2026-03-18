<?php

namespace App\Jobs;

use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use App\Jobs\SendWebhookDeliveryJob;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class MerchantWebhookFanoutJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $merchantId, public string $eventType, public array $payload)
    {
    }

    public function handle(): void
    {
        $subscriptions = WebhookSubscription::where('merchant_id', $this->merchantId)
            ->where('status', 'active')
            ->get();

        foreach ($subscriptions as $subscription) {
            if (!in_array($this->eventType, $subscription->event_types ?? [], true)) {
                continue;
            }

            $delivery = WebhookDelivery::create([
                'account_id' => $subscription->account_id,
                'webhook_subscription_id' => $subscription->id,
                'merchant_id' => $this->merchantId,
                'event_type' => $this->eventType,
                'payload' => $this->payload,
                'status' => 'pending',
                'next_attempt_at' => now(),
            ]);

            SendWebhookDeliveryJob::dispatch($delivery->id);
        }
    }
}
