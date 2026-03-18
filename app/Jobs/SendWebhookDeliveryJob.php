<?php

namespace App\Jobs;

use App\Models\WebhookDelivery;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Http;

class SendWebhookDeliveryJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $deliveryId)
    {
    }

    public function handle(): void
    {
        $delivery = WebhookDelivery::with('subscription')->findOrFail($this->deliveryId);
        $subscription = $delivery->subscription;

        if (!$subscription || $subscription->status !== 'active') {
            return;
        }

        $payload = $delivery->payload;
        $signature = hash_hmac('sha256', json_encode($payload), $subscription->secret);

        $response = Http::timeout(10)
            ->withHeaders([
                'X-Webhook-Signature' => $signature,
                'X-Event-Type' => $delivery->event_type,
            ])
            ->post($subscription->url, $payload);

        $delivery->attempts += 1;
        $delivery->last_attempt_at = now();
        $delivery->last_response_code = $response->status();
        $delivery->last_response_body = $response->body();

        if ($response->successful()) {
            $delivery->status = 'delivered';
        } else {
            $delivery->status = 'failed';
            $maxAttempts = (int) env('WEBHOOK_RETRY_MAX_ATTEMPTS', 5);
            if ($delivery->attempts < $maxAttempts) {
                $base = (int) env('WEBHOOK_RETRY_BASE_SECONDS', 60);
                $delivery->status = 'attempted';
                $delivery->next_attempt_at = now()->addSeconds($base * $delivery->attempts);
                self::dispatch($delivery->id)->delay($delivery->next_attempt_at);
            }
        }

        $delivery->save();
    }
}
