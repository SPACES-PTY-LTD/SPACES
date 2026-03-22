<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RefreshTokenRequest;
use App\Http\Requests\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Services\AuthService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthController extends Controller
{
    public function register(RegisterRequest $request, AuthService $authService)
    {
        $requestId = ApiResponse::requestId();
        $validated = $request->validated();
        Log::info('Register endpoint invoked', [
            'request_id' => $requestId,
            'path' => $request->path(),
            'method' => $request->method(),
            'origin' => $request->headers->get('origin'),
            'referer' => $request->headers->get('referer'),
            'content_type' => $request->headers->get('content-type'),
            'accept' => $request->headers->get('accept'),
            'email' => $validated['email'] ?? null,
            'name' => $validated['name'] ?? null,
            'has_password' => array_key_exists('password', $validated),
            'has_password_confirmation' => array_key_exists('password_confirmation', $request->all()),
        ]);

        try {
            $result = $authService->register($validated);
            Log::info('Register endpoint succeeded', [
                'request_id' => $requestId,
                'user_id' => $result['user']->id ?? null,
                'user_uuid' => $result['user']->user_uuid ?? null,
                'email' => $result['user']->email ?? null,
            ]);

            return ApiResponse::success([
                'token' => $result['token'],
                'user' => new UserResource($result['user']),
            ], [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Register failed', [
                'request_id' => $requestId,
                'error' => $e->getMessage(),
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return $this->apiError($e, 'REGISTER_FAILED', 'Unable to register.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function login(LoginRequest $request, AuthService $authService)
    {
        try {
            $result = $authService->login($request->validated());
            if (!$result) {
                return ApiResponse::error('INVALID_CREDENTIALS', 'Invalid credentials.', [], Response::HTTP_UNAUTHORIZED);
            }

            return ApiResponse::success([
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'user' => new UserResource($result['user']),
            ]);
        } catch (Throwable $e) {
            Log::error('Login failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'LOGIN_FAILED', 'Unable to login.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function refresh(RefreshTokenRequest $request, AuthService $authService)
    {
        try {
            $result = $authService->refresh($request->validated()['refresh_token']);
            if (!$result) {
                return ApiResponse::error('INVALID_REFRESH', 'Invalid refresh token.', [], Response::HTTP_UNAUTHORIZED);
            }

            return ApiResponse::success([
                'token' => $result['token'],
                'refresh_token' => $result['refresh_token'],
                'user' => new UserResource($result['user']),
            ]);
        } catch (Throwable $e) {
            Log::error('Refresh failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'REFRESH_FAILED', 'Unable to refresh token.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function logout(Request $request, AuthService $authService)
    {
        try {
            $token = $request->user()?->currentAccessToken();
            if ($token) {
                $authService->logout($request->user(), $token->id);
            }

            return ApiResponse::success(['message' => 'Logged out']);
        } catch (Throwable $e) {
            Log::error('Logout failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'LOGOUT_FAILED', 'Unable to logout.', Response::HTTP_BAD_REQUEST);
        }
    }
}
