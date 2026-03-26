<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\UploadUserProfilePhotoRequest;
use App\Http\Requests\UpdateLastAccessedMerchantRequest;
use App\Http\Requests\UpdateDriverProfileRequest;
use App\Http\Resources\UserResource;
use App\Models\Merchant;
use App\Support\ApiResponse;
use App\Support\MerchantAccess;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class MeController extends Controller
{
    public function show(Request $request)
    {
        try {
            $user = $request->user()->load(['account', 'merchants', 'lastAccessedMerchant']);

            return ApiResponse::success(new UserResource($user));
        } catch (Throwable $e) {
            Log::error('Profile fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'PROFILE_FAILED', 'Unable to load profile.');
        }
    }

    public function updateProfile(Request $request)
    {
        try {
            $user = $request->user()->loadMissing('account');
            $data = $request->validate([
                'name' => 'sometimes|required|string|max:255',
                'telephone' => 'sometimes|nullable|string|max:50',
                'account_country_code' => 'sometimes|required|string|size:2|regex:/^[A-Z]{2}$/',
            ]);

            if (array_key_exists('name', $data)) {
                $user->name = $data['name'];
            }

            if (array_key_exists('telephone', $data)) {
                $user->telephone = $data['telephone'];
            }

            if (
                array_key_exists('account_country_code', $data)
                && $user->account
                && (int) $user->account->owner_user_id === (int) $user->id
            ) {
                $user->account->country_code = $data['account_country_code'];
                $user->account->save();
            }

            if (!empty($data)) {
                $user->save();
            }

            return ApiResponse::success(new UserResource(
                $user->fresh()->load(['account', 'merchants', 'lastAccessedMerchant'])
            ));
        } catch (Throwable $e) {
            Log::error('Profile update failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);
            return $this->apiError($e, 'PROFILE_UPDATE_FAILED', 'Unable to update profile.');
        }
    }

    public function updatePassword(Request $request)
    {
        try {
            $user = $request->user();
            $validated = $request->validate([
                'current_password' => ['required', 'string'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ]);

            if (!$user || !Hash::check($validated['current_password'], $user->password)) {
                return ApiResponse::error(
                    'INVALID_PASSWORD',
                    'The current password is incorrect.',
                    ['current_password' => ['The current password is incorrect.']],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $user->password = $validated['password'];
            $user->save();

            return ApiResponse::success([
                'message' => 'Password updated successfully.',
            ]);
        } catch (Throwable $e) {
            Log::error('Password update failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);
            return $this->apiError($e, 'PASSWORD_UPDATE_FAILED', 'Unable to update password.');
        }
    }

    public function updateProfilePhoto(UploadUserProfilePhotoRequest $request)
    {
        try {
            $user = $request->user();
            $user->profile_photo_path = $this->storeProfilePhoto(
                $user->uuid,
                $request->file('photo'),
                $user->profile_photo_path
            );
            $user->save();

            return ApiResponse::success(new UserResource(
                $user->fresh()->load(['account', 'merchants', 'lastAccessedMerchant'])
            ));
        } catch (Throwable $e) {
            Log::error('Profile photo update failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);
            return $this->apiError($e, 'PROFILE_PHOTO_UPDATE_FAILED', 'Unable to update profile photo.');
        }
    }

    public function updateLastAccessedMerchant(UpdateLastAccessedMerchantRequest $request)
    {
        try {
            $user = $request->user();

            if ($user->role !== 'user') {
                return ApiResponse::error(
                    'FORBIDDEN',
                    'Only merchant users can save a last accessed merchant.',
                    [],
                    Response::HTTP_FORBIDDEN
                );
            }

            $merchant = Merchant::query()
                ->where('uuid', $request->validated()['merchant_id'])
                ->firstOrFail();

            if (!MerchantAccess::hasMerchantAccess($user, $merchant)) {
                return ApiResponse::error(
                    'FORBIDDEN',
                    'You are not authorized to access this merchant.',
                    [],
                    Response::HTTP_FORBIDDEN
                );
            }

            $user->forceFill([
                'last_accessed_merchant_id' => $merchant->id,
            ])->save();

            return ApiResponse::success(new UserResource(
                $user->fresh()->load(['merchants', 'lastAccessedMerchant'])
            ));
        } catch (Throwable $e) {
            Log::error('Last accessed merchant update failed', [
                'request_id' => ApiResponse::requestId(),
                'error' => $e->getMessage(),
            ]);
            return $this->apiError($e, 'LAST_ACCESSED_MERCHANT_UPDATE_FAILED', 'Unable to update last accessed merchant.');
        }
    }

    public function updateDriverProfile(UpdateDriverProfileRequest $request)
    {
        try {
            $user = $request->user();
            $data = $request->validated();

            if (array_key_exists('name', $data)) {
                $user->name = $data['name'];
            }

            if (array_key_exists('telephone', $data)) {
                $user->telephone = $data['telephone'];
            }

            if (!empty($data)) {
                $user->save();
            }

            return ApiResponse::success(new UserResource($user->fresh()->load(['merchants', 'lastAccessedMerchant'])));
        } catch (Throwable $e) {
            Log::error('Driver profile update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'DRIVER_PROFILE_UPDATE_FAILED', 'Unable to update driver profile.');
        }
    }

    private function storeProfilePhoto(string $userUuid, UploadedFile $photo, ?string $existingPath = null): string
    {
        $disk = Storage::disk('s3');
        $extension = $photo->getClientOriginalExtension();
        $filename = (string) Str::uuid().($extension ? '.'.$extension : '');
        $path = sprintf('profile-photos/%s/%s', $userUuid, $filename);

        $disk->putFileAs(dirname($path), $photo, basename($path), ['visibility' => 'public']);

        if (!empty($existingPath) && $existingPath !== $path) {
            $disk->delete($existingPath);
        }

        return $path;
    }
}
