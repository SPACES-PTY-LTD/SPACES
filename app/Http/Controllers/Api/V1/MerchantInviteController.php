<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AcceptMerchantInviteRequest;
use App\Http\Requests\InviteMerchantUserRequest;
use App\Http\Resources\MerchantInviteResource;
use App\Http\Resources\MerchantResource;
use App\Models\Merchant;
use App\Models\MerchantInvite;
use App\Services\InviteService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MerchantInviteController extends Controller
{
    public function preview(Request $request, InviteService $service)
    {
        try {
            $validated = $request->validate([
                'token' => ['required', 'string'],
            ]);

            return ApiResponse::success($service->previewInvite($validated['token']));
        } catch (Throwable $e) {
            Log::error('Invite preview failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_PREVIEW_FAILED', 'Unable to load invite preview.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function invite(InviteMerchantUserRequest $request, string $merchant_uuid, InviteService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $invite = $service->createInvite($merchant, $request->user(), $request->validated());

            return ApiResponse::success(new MerchantInviteResource($invite), [], Response::HTTP_CREATED);
        } catch (ValidationException $e) {
            return ApiResponse::error('MEMBER_ALREADY_EXISTS', 'User already a member.', $e->errors(), Response::HTTP_CONFLICT);
        } catch (Throwable $e) {
            Log::error('Invite failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_FAILED', 'Unable to send invite.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function accept(AcceptMerchantInviteRequest $request, InviteService $service)
    {
        try {
            $result = $service->acceptInvite($request->validated()['token'], $request->validated());

            return ApiResponse::success([
                'token' => $result['token'],
                'user' => [
                    'email' => $result['user']->email,
                    'name' => $result['user']->name,
                    'created' => (bool) $result['created'],
                ],
                'merchant' => new MerchantResource($result['merchant']),
                'membership_role' => $result['role'],
            ]);
        } catch (ValidationException $e) {
            return ApiResponse::error(
                $this->resolveAcceptInviteErrorCode($e),
                $this->resolveAcceptInviteErrorMessage($e),
                $e->errors(),
                Response::HTTP_UNPROCESSABLE_ENTITY
            );
        } catch (Throwable $e) {
            Log::error('Invite accept failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_ACCEPT_FAILED', 'Unable to accept invite.', Response::HTTP_BAD_REQUEST);
        }
    }

    public function list(Request $request, string $merchant_uuid)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('viewUsers', $merchant);

            $perPage = min((int) $request->get('per_page', 15), 100);
            $invites = MerchantInvite::where('merchant_id', $merchant->id)
                ->whereNull('revoked_at')
                ->whereNull('accepted_at')
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($invites, MerchantInviteResource::collection($invites));
        } catch (Throwable $e) {
            Log::error('Invite list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_LIST_FAILED', 'Unable to list invites.');
        }
    }

    public function resend(string $merchant_uuid, string $invite_uuid, InviteService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $invite = MerchantInvite::where('uuid', $invite_uuid)->firstOrFail();
            $service->resendInvite($invite);

            return ApiResponse::success(['message' => 'Invite resent']);
        } catch (ValidationException $e) {
            return ApiResponse::error('INVITE_RESEND_THROTTLED', 'Invite resend limit reached.', $e->errors(), Response::HTTP_TOO_MANY_REQUESTS);
        } catch (Throwable $e) {
            Log::error('Invite resend failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_RESEND_FAILED', 'Unable to resend invite.');
        }
    }

    public function revoke(string $merchant_uuid, string $invite_uuid, InviteService $service)
    {
        try {
            $merchant = Merchant::where('uuid', $merchant_uuid)->firstOrFail();
            $this->authorize('manageUsers', $merchant);

            $invite = MerchantInvite::where('uuid', $invite_uuid)->firstOrFail();
            $service->revokeInvite($invite);

            return ApiResponse::success(['message' => 'Invite revoked']);
        } catch (Throwable $e) {
            Log::error('Invite revoke failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'INVITE_REVOKE_FAILED', 'Unable to revoke invite.');
        }
    }

    protected function resolveAcceptInviteErrorCode(ValidationException $exception): string
    {
        $details = $exception->errors();
        $firstDetail = collect($details)->flatten()->first();

        return is_string($firstDetail) && $firstDetail !== ''
            ? $firstDetail
            : 'INVITE_INVALID';
    }

    protected function resolveAcceptInviteErrorMessage(ValidationException $exception): string
    {
        return match ($this->resolveAcceptInviteErrorCode($exception)) {
            'NAME_AND_PASSWORD_REQUIRED' => 'Complete your name and password to accept this invite.',
            'INVITE_EXPIRED' => 'This invite has expired. Ask for a new invite link.',
            'INVITE_REVOKED' => 'This invite has been revoked. Ask for a new invite link.',
            'INVITE_ALREADY_ACCEPTED' => 'This invite has already been accepted. Sign in to continue.',
            'INVITE_NOT_FOUND' => 'This invite link is invalid or no longer available.',
            default => 'Unable to accept invite.',
        };
    }
}
