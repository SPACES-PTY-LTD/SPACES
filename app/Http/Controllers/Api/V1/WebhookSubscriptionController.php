<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreWebhookSubscriptionRequest;
use App\Http\Requests\UpdateWebhookSubscriptionRequest;
use App\Http\Resources\WebhookDeliveryResource;
use App\Http\Resources\WebhookSubscriptionResource;
use App\Jobs\SendWebhookDeliveryJob;
use App\Models\Merchant;
use App\Models\WebhookDelivery;
use App\Models\WebhookSubscription;
use App\Services\WebhookService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class WebhookSubscriptionController extends Controller
{
    public function store(StoreWebhookSubscriptionRequest $request, WebhookService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $request->validated()['merchant_id'])->firstOrFail();
            $this->authorize('create', [WebhookSubscription::class, $merchant]);

            $subscription = $service->createSubscription($merchant, [
                'url' => $request->validated()['url'],
                'event_types' => $request->validated()['event_types'],
                'secret' => Str::random(32),
            ]);

            return ApiResponse::success(new WebhookSubscriptionResource($subscription), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Webhook subscription create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_CREATE_FAILED', 'Unable to create subscription.');
        }
    }

    public function index(Request $request)
    {
        try {
            $merchantId = $request->get('merchant_id') ?? $request->get('merchant_uuid');
            $merchant = Merchant::where('uuid', $merchantId)->firstOrFail();
            $this->authorize('view', $merchant);

            $perPage = min((int) $request->get('per_page', 15), 100);
            $subscriptions = WebhookSubscription::where('merchant_id', $merchant->id)
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($subscriptions, WebhookSubscriptionResource::collection($subscriptions));
        } catch (Throwable $e) {
            Log::error('Webhook subscription list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_LIST_FAILED', 'Unable to list subscriptions.');
        }
    }

    public function show(Request $request, string $subscription_uuid)
    {
        try {
            $merchantId = $request->get('merchant_id') ?? $request->get('merchant_uuid');
            $query = WebhookSubscription::query()->where('uuid', $subscription_uuid);
            if (!empty($merchantId)) {
                $merchant = Merchant::where('uuid', $merchantId)->firstOrFail();
                $query->where('merchant_id', $merchant->id);
            }

            $subscription = $query->firstOrFail();
            $this->authorize('view', $subscription);

            $perPage = min((int) $request->get('per_page', 15), 100);
            $deliveries = WebhookDelivery::where('webhook_subscription_id', $subscription->id)
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::success([
                'subscription' => new WebhookSubscriptionResource($subscription),
                'deliveries' => WebhookDeliveryResource::collection($deliveries),
            ], [
                'current_page' => $deliveries->currentPage(),
                'per_page' => $deliveries->perPage(),
                'total' => $deliveries->total(),
                'last_page' => $deliveries->lastPage(),
            ]);
        } catch (Throwable $e) {
            Log::error('Webhook subscription details failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_SHOW_FAILED', 'Unable to load subscription details.');
        }
    }

    public function update(UpdateWebhookSubscriptionRequest $request, string $subscription_uuid)
    {
        try {
            $subscription = WebhookSubscription::where('uuid', $subscription_uuid)->firstOrFail();
            $this->authorize('update', $subscription);

            $validated = $request->validated();
            if (array_key_exists('url', $validated)) {
                $subscription->url = $validated['url'];
            }
            if (array_key_exists('event_types', $validated)) {
                $subscription->event_types = $validated['event_types'];
            }
            $subscription->save();

            return ApiResponse::success(new WebhookSubscriptionResource($subscription));
        } catch (Throwable $e) {
            Log::error('Webhook subscription update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_UPDATE_FAILED', 'Unable to update subscription.');
        }
    }

    public function destroy(string $subscription_uuid)
    {
        try {
            $subscription = WebhookSubscription::where('uuid', $subscription_uuid)->firstOrFail();
            $this->authorize('delete', $subscription);

            $subscription->delete();

            return ApiResponse::success(['message' => 'Subscription deleted']);
        } catch (Throwable $e) {
            Log::error('Webhook subscription delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_DELETE_FAILED', 'Unable to delete subscription.');
        }
    }

    public function test(string $subscription_uuid)
    {
        try {
            $subscription = WebhookSubscription::where('uuid', $subscription_uuid)->firstOrFail();
            $this->authorize('view', $subscription);

            $delivery = WebhookDelivery::create([
                'account_id' => $subscription->account_id,
                'webhook_subscription_id' => $subscription->id,
                'merchant_id' => $subscription->merchant_id,
                'event_type' => 'webhook.test',
                'payload' => ['message' => 'Test webhook'],
                'status' => 'pending',
                'next_attempt_at' => now(),
            ]);

            SendWebhookDeliveryJob::dispatch($delivery->id);

            return ApiResponse::success(['message' => 'Webhook test queued']);
        } catch (Throwable $e) {
            Log::error('Webhook subscription test failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_SUBSCRIPTION_TEST_FAILED', 'Unable to send test webhook.');
        }
    }
}
