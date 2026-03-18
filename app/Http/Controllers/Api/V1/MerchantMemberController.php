<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\MerchantMemberResource;
use App\Models\Merchant;
use App\Models\User;
use App\Services\MerchantService;
use App\Support\MerchantAccess;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantMemberController extends Controller
{
    public function index(Request $request, string $merchant_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('viewUsers', $merchant);

            $members = $service->listMembers($merchant, (int) $request->get('per_page', 15));

            return ApiResponse::paginated($members, MerchantMemberResource::collection($members));
        } catch (Throwable $e) {
            Log::error('Members list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MEMBER_LIST_FAILED', 'Unable to list members.');
        }
    }

    public function update(Request $request, string $merchant_uuid, string $user_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $role = MerchantAccess::normalizeRole(
                $request->validate([
                    'role' => 'required|in:'.implode(',', array_merge(MerchantAccess::ASSIGNABLE_ROLES, MerchantAccess::LEGACY_ASSIGNABLE_ROLES)),
                ])['role']
            );
            $member = User::where('uuid', $user_uuid)->firstOrFail();

            $service->updateMemberRole($merchant, $member, $role);

            return ApiResponse::success(['message' => 'Member updated']);
        } catch (Throwable $e) {
            Log::error('Member update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MEMBER_UPDATE_FAILED', 'Unable to update member.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function destroy(string $merchant_uuid, string $user_uuid, MerchantService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $member = User::where('uuid', $user_uuid)->firstOrFail();
            $service->removeMember($merchant, $member);

            return ApiResponse::success(['message' => 'Member removed']);
        } catch (Throwable $e) {
            Log::error('Member remove failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MEMBER_REMOVE_FAILED', 'Unable to remove member.', Response::HTTP_BAD_REQUEST);
        }
    }
}
