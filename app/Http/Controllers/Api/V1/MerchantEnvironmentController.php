<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreMerchantEnvironmentRequest;
use App\Http\Requests\UpdateMerchantEnvironmentRequest;
use App\Http\Resources\MerchantEnvironmentResource;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantEnvironmentController extends Controller
{
    public function index(Request $request, string $merchant_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('view', $merchant);

            $perPage = min((int) ($request->get('per_page', 15)), 100);
            $environments = $merchant->environments()->orderByDesc('created_at')->paginate($perPage);

            return ApiResponse::paginated($environments, MerchantEnvironmentResource::collection($environments));
        } catch (Throwable $e) {
            Log::error('Merchant environments list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_LIST_FAILED', 'Unable to list environments.');
        }
    }

    public function store(StoreMerchantEnvironmentRequest $request, string $merchant_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('create', [MerchantEnvironment::class, $merchant]);

            $token = Str::random(64);

            $environment = MerchantEnvironment::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'name' => $request->validated()['name'],
                'color' => $request->validated()['color'],
                'url' => $request->validated()['url'],
                'token' => $token,
                'token_hash' => hash('sha256', $token),
            ]);

            return ApiResponse::success(
                new MerchantEnvironmentResource($environment->load('merchant'))
                
            , [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Merchant environment create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_CREATE_FAILED', 'Unable to create environment.');
        }
    }

    public function show(string $merchant_uuid, string $environment_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $environment = MerchantEnvironment::where('uuid', $environment_uuid)
                ->where('merchant_id', $merchant->id)
                ->firstOrFail();

            $this->authorize('view', $environment);

            return ApiResponse::success(new MerchantEnvironmentResource($environment->load('merchant')));
        } catch (Throwable $e) {
            Log::error('Merchant environment fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_NOT_FOUND', 'Environment not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(UpdateMerchantEnvironmentRequest $request, string $merchant_uuid, string $environment_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $environment = MerchantEnvironment::where('uuid', $environment_uuid)
                ->where('merchant_id', $merchant->id)
                ->firstOrFail();

            $this->authorize('update', $environment);

            $environment->fill($request->validated());
            $environment->save();

            return ApiResponse::success(new MerchantEnvironmentResource($environment->load('merchant')));
        } catch (Throwable $e) {
            Log::error('Merchant environment update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_UPDATE_FAILED', 'Unable to update environment.');
        }
    }

    public function destroy(string $merchant_uuid, string $environment_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $environment = MerchantEnvironment::where('uuid', $environment_uuid)
                ->where('merchant_id', $merchant->id)
                ->firstOrFail();

            $this->authorize('delete', $environment);

            $environment->delete();

            return ApiResponse::success(['message' => 'Environment deleted']);
        } catch (Throwable $e) {
            Log::error('Merchant environment delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_DELETE_FAILED', 'Unable to delete environment.');
        }
    }

    public function rotateToken(string $merchant_uuid, string $environment_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $environment = MerchantEnvironment::where('uuid', $environment_uuid)
                ->where('merchant_id', $merchant->id)
                ->firstOrFail();

            $this->authorize('update', $environment);

            $token = Str::random(64);
            $environment->token = $token;
            $environment->token_hash = hash('sha256', $token);
            $environment->save();

            return ApiResponse::success(new MerchantEnvironmentResource($environment->load('merchant')));
        } catch (Throwable $e) {
            Log::error('Merchant environment token rotate failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_ENVIRONMENT_TOKEN_FAILED', 'Unable to rotate token.');
        }
    }
}
