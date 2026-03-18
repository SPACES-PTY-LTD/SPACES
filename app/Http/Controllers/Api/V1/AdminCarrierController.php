<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCarrierRequest;
use App\Http\Requests\UpdateCarrierRequest;
use App\Http\Resources\CarrierResource;
use App\Models\Carrier;
use App\Models\Merchant;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminCarrierController extends Controller
{
    public function index(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $sortableColumns = [
                'created_at' => 'created_at',
                'name' => 'name',
                'code' => 'code',
                'type' => 'type',
                'enabled' => 'enabled',
            ];
            $sortBy = (string) $request->get('sort_by', 'created_at');
            $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
            $sortDirection = strtolower((string) $request->get('sort_direction', $request->get('sort_dir', 'desc')));
            $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';
            $query = Carrier::query()
                ->orderBy($sortColumn, $sortDirection)
                ->orderBy('id');

            if ($this->isMerchant($request)) {
                $merchant = $this->resolveMerchant($request);
                if (!$merchant) {
                    return ApiResponse::error('MERCHANT_NOT_FOUND', 'Merchant profile not found.', [], Response::HTTP_FORBIDDEN);
                }
                $query->where('merchant_id', $merchant->id);
            }

            if ($request->has('enabled')) {
                $query->where('enabled', (bool) $request->get('enabled'));
            }

            if ($request->has('type')) {
                $query->where('type', $request->get('type'));
            }

            $carriers = $query->paginate($perPage);

            return ApiResponse::paginated($carriers, CarrierResource::collection($carriers));
        } catch (Throwable $e) {
            Log::error('Admin carriers list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CARRIERS_FAILED', 'Unable to list carriers.');
        }
    }

    public function show(string $carrier_uuid)
    {
        try {
            $carrier = Carrier::where('uuid', $carrier_uuid)->firstOrFail();
            if ($this->isMerchant(request())) {
                $merchant = $this->resolveMerchant(request());
                if (!$merchant || $carrier->merchant_id !== $merchant->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this carrier.', [], Response::HTTP_FORBIDDEN);
                }
            }

            return ApiResponse::success(new CarrierResource($carrier));
        } catch (Throwable $e) {
            Log::error('Admin carrier fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CARRIER_NOT_FOUND', 'Carrier not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(StoreCarrierRequest $request)
    {
        try {
            $data = $request->validated();

            if ($this->isMerchant($request)) {
                $merchant = $this->resolveMerchant($request);
                if (!$merchant) {
                    return ApiResponse::error('MERCHANT_NOT_FOUND', 'Merchant profile not found.', [], Response::HTTP_FORBIDDEN);
                }

                $existing = Carrier::where('merchant_id', $merchant->id)->first();
                if ($existing) {
                    return ApiResponse::error('MERCHANT_CARRIER_EXISTS', 'Merchant already has a carrier.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
                }

                $data['merchant_id'] = $merchant->id;
                $data['code'] = $data['code'] ?? $this->buildMerchantCarrierCode($merchant);
                $data['name'] = $data['name'] ?? $merchant->name;
                $data['type'] = $data['type'] ?? 'internal';
                $data['enabled'] = $data['enabled'] ?? true;
            }

            $carrier = Carrier::create($data);

            return ApiResponse::success(new CarrierResource($carrier), [], Response::HTTP_CREATED);
        } catch (Throwable $e) {
            Log::error('Admin carrier create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CARRIER_CREATE_FAILED', 'Unable to create carrier.');
        }
    }

    public function update(UpdateCarrierRequest $request, string $carrier_uuid)
    {
        try {
            $carrier = Carrier::where('uuid', $carrier_uuid)->firstOrFail();
            if ($this->isMerchant($request)) {
                $merchant = $this->resolveMerchant($request);
                if (!$merchant || $carrier->merchant_id !== $merchant->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to update this carrier.', [], Response::HTTP_FORBIDDEN);
                }
            }
            $carrier->update($request->validated());

            return ApiResponse::success(new CarrierResource($carrier));
        } catch (Throwable $e) {
            Log::error('Admin carrier update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CARRIER_UPDATE_FAILED', 'Unable to update carrier.');
        }
    }

    public function destroy(string $carrier_uuid)
    {
        try {
            $carrier = Carrier::where('uuid', $carrier_uuid)->firstOrFail();
            if ($this->isMerchant(request())) {
                $merchant = $this->resolveMerchant(request());
                if (!$merchant || $carrier->merchant_id !== $merchant->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to delete this carrier.', [], Response::HTTP_FORBIDDEN);
                }
            }
            $carrier->delete();

            return ApiResponse::success(['message' => 'Carrier deleted']);
        } catch (Throwable $e) {
            Log::error('Admin carrier delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_CARRIER_DELETE_FAILED', 'Unable to delete carrier.');
        }
    }

    private function isMerchant(Request $request): bool
    {
        return $request->user()?->role === 'user';
    }

    private function resolveMerchant(Request $request): ?Merchant
    {
        $user = $request->user();
        if (!$user) {
            return null;
        }

        $merchant = $user->merchants()->orderBy('merchants.id')->first();
        if (!$merchant) {
            $merchant = $user->ownedMerchants()->orderBy('id')->first();
        }

        return $merchant;
    }

    private function buildMerchantCarrierCode(Merchant $merchant): string
    {
        $base = 'mrc_'.$merchant->id.'_'.Str::lower(Str::random(6));

        return substr($base, 0, 50);
    }
}
