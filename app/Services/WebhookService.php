<?php

namespace App\Services;

use App\Jobs\MerchantWebhookFanoutJob;
use App\Models\Merchant;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class WebhookService
{
    public function createSubscription(Merchant $merchant, array $data): WebhookSubscription
    {
        return WebhookSubscription::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'url' => $data['url'],
            'secret' => $data['secret'],
            'event_types' => $data['event_types'],
            'status' => $data['status'] ?? 'active',
        ]);
    }

    public function listSubscriptions(Merchant $merchant, int $perPage = 15): LengthAwarePaginator
    {
        return WebhookSubscription::where('merchant_id', $merchant->id)
            ->orderByDesc('created_at')
            ->paginate(min($perPage, 100));
    }

    public function deleteSubscription(WebhookSubscription $subscription): void
    {
        $subscription->delete();
    }

    public function fanout(Merchant $merchant, string $eventType, array $payload): void
    {
        MerchantWebhookFanoutJob::dispatch($merchant->id, $eventType, $payload);
    }
}
