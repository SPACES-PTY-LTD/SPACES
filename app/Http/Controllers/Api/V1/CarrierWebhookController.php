<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CarrierWebhookRequest;
use App\Jobs\ProcessCarrierWebhookJob;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class CarrierWebhookController extends Controller
{
    public function handle(CarrierWebhookRequest $request, string $carrier_code)
    {
        try {
            $header = $request->header('X-Carrier-Secret');
            $envKey = 'CARRIER_WEBHOOK_SECRET_'.strtoupper($carrier_code);
            $expected = env($envKey);

            if (!$expected || $header !== $expected) {
                return ApiResponse::error('UNAUTHORIZED', 'Invalid carrier secret.', [], Response::HTTP_UNAUTHORIZED);
            }

            ProcessCarrierWebhookJob::dispatch($carrier_code, $request->all());

            return ApiResponse::success(['message' => 'Webhook received'], [], Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Carrier webhook failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'WEBHOOK_FAILED', 'Unable to process webhook.');
        }
    }
}
