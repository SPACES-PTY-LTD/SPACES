<?php

namespace App\Http\Middleware;

use App\Models\MerchantEnvironment;
use App\Models\ApiCallLog;
use App\Support\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Response;

class ApiAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        if (!$token) {
            return ApiResponse::error('UNAUTHENTICATED', 'Authentication required.', [], Response::HTTP_UNAUTHORIZED);
        }

        $personalToken = PersonalAccessToken::findToken($token);
        if ($personalToken && $personalToken->tokenable) {
            $user = $personalToken->tokenable;
            Auth::setUser($user);
            $request->setUserResolver(fn () => $user);

            return $next($request);
        }

        $env = MerchantEnvironment::with('merchant')->where('token_hash', hash('sha256', $token))->first();
        if ($env) {
            $env->forceFill(['last_used_at' => now()])->save();
            $request->attributes->set('merchant_environment', $env);
            $request->attributes->set('merchant', $env->merchant);

            $inject = [];
            if (!$request->has('merchant_uuid') && !$request->has('merchant_id')) {
                $inject['merchant_uuid'] = $env->merchant->uuid;
                $inject['merchant_id'] = $env->merchant->uuid;
            }
            if (!$request->has('environment_uuid') && !$request->has('environment_id')) {
                $inject['environment_uuid'] = $env->uuid;
                $inject['environment_id'] = $env->uuid;
            }
            if ($inject) {
                $request->merge($inject);
            }

            $startedAt = microtime(true);
            $response = $next($request);
            $this->logEnvironmentCall($request, $response, $env, $startedAt);

            return $response;
        }

        return ApiResponse::error('UNAUTHENTICATED', 'Invalid API token.', [], Response::HTTP_UNAUTHORIZED);
    }

    private function logEnvironmentCall(Request $request, $response, MerchantEnvironment $env, float $startedAt): void
    {
        try {
            $content = null;
            if ($response instanceof BinaryFileResponse) {
                $content = null;
            } elseif (is_object($response) && method_exists($response, 'getContent')) {
                $content = $response->getContent();
            }

            $account_id = $request->user()?->account_id ?? $env->account_id ?? $env->merchant?->account_id;
          

            ApiCallLog::create([
                'request_id' => ApiResponse::requestId(),
                'environment_id' => $env->id,
                'merchant_id' => $env->merchant_id,
                'account_id' => $account_id,
                'user_id' => $request->user()?->id,
                'source' => $request->header('X-Source'),
                'origin_url' => $request->header('Origin') ?? $request->header('Referer'),
                'idempotency_key' => $request->header('Idempotency-Key'),
                'method' => $request->getMethod(),
                'path' => $request->getPathInfo(),
                'query' => $request->query(),
                'status_code' => method_exists($response, 'getStatusCode') ? $response->getStatusCode() : 200,
                'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'response' => $content,
            ]);
        } catch (\Throwable $e) {
            Log::warning('Failed to log API call', [
                'error' => $e->getMessage(),
                'request_id' => ApiResponse::requestId(),
            ]);
        }
    }
}
