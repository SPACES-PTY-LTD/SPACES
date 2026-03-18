<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\InviteMerchantUserRequest;
use App\Http\Resources\MerchantPersonResource;
use App\Models\Merchant;
use App\Services\MerchantUserService;
use App\Support\MerchantAccess;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException as LaravelValidationException;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantUserController extends Controller
{
    public function index(Request $request, string $merchant_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('viewUsers', $merchant);

            $people = $service->listPeople($merchant, (int) $request->get('per_page', 15));

            return ApiResponse::paginated($people, MerchantPersonResource::collection($people));
        } catch (Throwable $e) {
            Log::error('Merchant people list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PEOPLE_LIST_FAILED', 'Unable to list merchant users.');
        }
    }

    public function show(string $merchant_uuid, string $person_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('viewUsers', $merchant);

            $person = $service->getPerson($merchant, $person_uuid);

            return ApiResponse::success(new MerchantPersonResource($person));
        } catch (Throwable $e) {
            Log::error('Merchant person fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PERSON_FETCH_FAILED', 'Unable to fetch merchant user.', Response::HTTP_NOT_FOUND);
        }
    }

    public function store(InviteMerchantUserRequest $request, string $merchant_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $invite = $service->invite($merchant, $request->user(), $request->validated());

            return ApiResponse::success(new MerchantPersonResource($invite), [], Response::HTTP_CREATED);
        } catch (ValidationException $e) {
            return ApiResponse::error('MEMBER_ALREADY_EXISTS', 'User already a member.', $e->errors(), Response::HTTP_CONFLICT);
        } catch (Throwable $e) {
            Log::error('Merchant person invite failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PERSON_INVITE_FAILED', 'Unable to send invite.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function update(Request $request, string $merchant_uuid, string $person_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $validated = $request->validate([
                'role' => 'sometimes|required|in:'.implode(',', array_merge(
                    MerchantAccess::ASSIGNABLE_ROLES,
                    MerchantAccess::LEGACY_ASSIGNABLE_ROLES
                )),
                'name' => 'sometimes|required|string|max:255',
                'telephone' => 'sometimes|nullable|string|max:50',
            ]);

            if ($validated === []) {
                throw LaravelValidationException::withMessages([
                    'person' => ['AT_LEAST_ONE_FIELD_REQUIRED'],
                ]);
            }

            if (array_key_exists('role', $validated)) {
                $validated['role'] = MerchantAccess::normalizeRole($validated['role']);
            }

            $person = $service->updatePerson($merchant, $request->user(), $person_uuid, $validated);

            return ApiResponse::success(new MerchantPersonResource($person));
        } catch (Throwable $e) {
            Log::error('Merchant person update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PERSON_UPDATE_FAILED', 'Unable to update merchant user.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function destroy(string $merchant_uuid, string $person_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $service->deletePerson($merchant, $person_uuid);

            return ApiResponse::success(['message' => 'Merchant user removed']);
        } catch (Throwable $e) {
            Log::error('Merchant person delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PERSON_DELETE_FAILED', 'Unable to remove merchant user.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function resend(string $merchant_uuid, string $person_uuid, MerchantUserService $service)
    {
        try {
            $merchant = Merchant::query()->where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $invite = $service->resendInvite($merchant, $person_uuid);

            return ApiResponse::success(new MerchantPersonResource($invite));
        } catch (ValidationException $e) {
            return ApiResponse::error('INVITE_RESEND_THROTTLED', 'Invite resend limit reached.', $e->errors(), Response::HTTP_TOO_MANY_REQUESTS);
        } catch (Throwable $e) {
            Log::error('Merchant person resend failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'MERCHANT_PERSON_RESEND_FAILED', 'Unable to resend merchant invite.', Response::HTTP_BAD_REQUEST);
        }
    }
}
