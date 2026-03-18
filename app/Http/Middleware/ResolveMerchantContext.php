<?php

namespace App\Http\Middleware;

use App\Models\Merchant;
use App\Support\MerchantAccess;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ResolveMerchantContext
{
    public function handle(Request $request, Closure $next)
    {
        $environment = $request->attributes->get('merchant_environment');
        if ($environment) {
            $requestMerchant = $request->input('merchant_id') ?? $request->input('merchant_uuid');
            $headerMerchant = $request->header('X-Merchant-Id');

            if ($headerMerchant && $headerMerchant !== $environment->merchant->uuid) {
                return ApiResponse::error(
                    'MERCHANT_CONTEXT_MISMATCH',
                    'Header merchant does not match the authenticated environment merchant.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            if ($requestMerchant && $requestMerchant !== $environment->merchant->uuid) {
                return ApiResponse::error(
                    'MERCHANT_CONTEXT_MISMATCH',
                    'Request merchant does not match the authenticated environment merchant.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $request->attributes->set('merchant', $environment->merchant);
            $request->attributes->set('merchant_id', $environment->merchant->id);
            $request->attributes->set('merchant_uuid', $environment->merchant->uuid);
            $request->merge([
                'merchant_id' => $environment->merchant->uuid,
                'merchant_uuid' => $environment->merchant->uuid,
            ]);

            return $next($request);
        }

        $user = $request->user();
        if (!$user || $user->role !== 'user') {
            return $next($request);
        }

        $headerMerchant = $request->header('X-Merchant-Id');
        $requestMerchant = $request->input('merchant_id') ?? $request->input('merchant_uuid');
        $identifier = $headerMerchant ?: $requestMerchant;

        if (!$identifier) {
            return ApiResponse::error(
                'VALIDATION',
                'The merchant_id field is required for this request.',
                [],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        $merchant = $this->resolveMerchant($identifier);
        if (!$merchant) {
            return ApiResponse::error(
                'VALIDATION',
                'The selected merchant_id is invalid.',
                [],
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        }

        if ($headerMerchant && $requestMerchant) {
            $headerResolved = $this->resolveMerchant($headerMerchant);
            $requestResolved = $this->resolveMerchant($requestMerchant);

            if (!$headerResolved || !$requestResolved || $headerResolved->id !== $requestResolved->id) {
                return ApiResponse::error(
                    'MERCHANT_CONTEXT_MISMATCH',
                    'X-Merchant-Id header and merchant_id request parameter must refer to the same merchant.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $merchant = $headerResolved;
        }

        if (!MerchantAccess::hasMerchantAccess($user, $merchant)) {
            return ApiResponse::error(
                'FORBIDDEN',
                'You are not authorized to access this merchant.',
                [],
                Response::HTTP_FORBIDDEN
            );
        }

        if (!empty($user->account_id) && $merchant->account_id !== $user->account_id) {
            return ApiResponse::error(
                'FORBIDDEN',
                'You are not authorized to access this merchant.',
                [],
                Response::HTTP_FORBIDDEN
            );
        }

        $request->attributes->set('merchant', $merchant);
        $request->attributes->set('merchant_id', $merchant->id);
        $request->attributes->set('merchant_uuid', $merchant->uuid);
        $request->merge([
            'merchant_id' => $merchant->uuid,
            'merchant_uuid' => $merchant->uuid,
        ]);

        return $next($request);
    }

    private function resolveMerchant(string $identifier): ?Merchant
    {
        return Merchant::query()
            ->where('uuid', $identifier)
            ->orWhere('id', ctype_digit($identifier) ? (int) $identifier : -1)
            ->first();
    }
}
