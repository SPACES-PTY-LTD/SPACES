<?php

namespace App\Http\Middleware;

use App\Models\IdempotencyKey;
use App\Models\Shipment;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class IdempotencyKeyMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $key = $request->header('Idempotency-Key');
        if (!$key) {
            return ApiResponse::error('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required.', [], Response::HTTP_BAD_REQUEST);
        }

        $shipmentUuid = $request->route('shipment_uuid');
        $shipment = $shipmentUuid ? Shipment::where('uuid', $shipmentUuid)->first() : null;

        if ($shipment) {
            $requestHash = hash('sha256', (string) $request->getContent());
            $existing = IdempotencyKey::where('merchant_id', $shipment->merchant_id)
                ->where('account_id', $shipment->account_id)
                ->where('key', $key)
                ->where('expires_at', '>', now())
                ->first();

            if ($existing) {
                if ($existing->request_hash !== $requestHash) {
                    return ApiResponse::error('IDEMPOTENCY_KEY_CONFLICT', 'Idempotency-Key already used with a different request payload.', [], Response::HTTP_CONFLICT);
                }

                return response($existing->response_body, $existing->response_code)
                    ->header('Content-Type', 'application/json');
            }

            $request->attributes->set('idempotency_context', [
                'key' => $key,
                'account_id' => $shipment->account_id,
                'merchant_id' => $shipment->merchant_id,
                'request_hash' => $requestHash,
            ]);
        }

        $response = $next($request);

        $context = $request->attributes->get('idempotency_context');
        if ($context && $response->getStatusCode() >= 200 && $response->getStatusCode() < 300) {
            IdempotencyKey::create([
                'account_id' => $context['account_id'],
                'merchant_id' => $context['merchant_id'],
                'key' => $context['key'],
                'request_hash' => $context['request_hash'],
                'response_code' => $response->getStatusCode(),
                'response_body' => (string) $response->getContent(),
                'expires_at' => now()->addHours((int) env('IDEMPOTENCY_EXPIRES_HOURS', 24)),
            ]);
        }

        return $response;
    }
}
