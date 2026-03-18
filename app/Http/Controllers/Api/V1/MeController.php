<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\UserResource;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class MeController extends Controller
{
    public function show(Request $request)
    {
        try {
            $user = $request->user()->load('merchants');

            return ApiResponse::success(new UserResource($user));
        } catch (Throwable $e) {
            Log::error('Profile fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PROFILE_FAILED', 'Unable to load profile.');
        }
    }
}
