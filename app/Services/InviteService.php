<?php

namespace App\Services;

use App\Jobs\SendMerchantInviteEmailJob;
use App\Models\Merchant;
use App\Models\MerchantInvite;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Validation\ValidationException;

class InviteService
{
    public function previewInvite(string $token): array
    {
        $tokenHash = hash('sha256', $token);

        $invite = MerchantInvite::query()
            ->with(['merchant', 'invitedBy'])
            ->where('token_hash', $tokenHash)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->first();

        if (!$invite) {
            throw new ModelNotFoundException();
        }

        $existingUser = User::query()->where('email', $invite->email)->first();

        return [
            'email' => $invite->email,
            'recipient_name' => $existingUser?->name,
            'merchant_name' => $invite->merchant?->name,
            'role' => $invite->role,
            'expires_at' => optional($invite->expires_at)->toIso8601String(),
            'invited_by' => $invite->invitedBy
                ? [
                    'name' => $invite->invitedBy->name,
                    'email' => $invite->invitedBy->email,
                ]
                : null,
        ];
    }

    public function createInvite(Merchant $merchant, User $inviter, array $data): MerchantInvite
    {
        $existingMember = $merchant->users()->where('users.email', $data['email'])->exists();
        if ($existingMember) {
            throw ValidationException::withMessages(['email' => ['MEMBER_ALREADY_EXISTS']]);
        }

        $token = Str::random(64);
        $tokenHash = hash('sha256', $token);

        $invite = MerchantInvite::create([
            'account_id' => $merchant->account_id,
            'merchant_id' => $merchant->id,
            'invited_by_user_id' => $inviter->id,
            'email' => $data['email'],
            'role' => MerchantAccess::normalizeRole($data['role']) ?? $data['role'],
            'token_hash' => $tokenHash,
            'expires_at' => now()->addHours((int) env('INVITE_EXPIRES_HOURS', 168)),
        ]);

        SendMerchantInviteEmailJob::dispatch($invite->id, $token);

        return $invite;
    }

    public function acceptInvite(string $token, array $data = []): array
    {
        $tokenHash = hash('sha256', $token);

        $invite = MerchantInvite::where('token_hash', $tokenHash)
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->where('expires_at', '>', now())
            ->firstOrFail();

        $user = User::where('email', $invite->email)->first();
        $created = false;

        if (!$user) {
            if (empty($data['name']) || empty($data['password'])) {
                throw ValidationException::withMessages(['user' => ['NAME_AND_PASSWORD_REQUIRED']]);
            }

            $user = User::create([
                'name' => $data['name'],
                'email' => $invite->email,
                'password' => $data['password'],
                'role' => 'user',
                'account_id' => $invite->merchant->account_id,
            ]);
            $created = true;
        }

        if ($user->account_id === null && $invite->merchant?->account_id) {
            $user->forceFill(['account_id' => $invite->merchant->account_id])->save();
        }

        $invite->merchant->users()->syncWithoutDetaching([
            $user->id => ['role' => $invite->role],
        ]);

        $invite->accepted_at = now();
        $invite->save();

        $tokenValue = $created ? $user->createToken('api')->plainTextToken : null;

        return [
            'user' => $user,
            'created' => $created,
            'token' => $tokenValue,
            'merchant' => $invite->merchant,
            'role' => $invite->role,
        ];
    }

    public function resendInvite(MerchantInvite $invite): void
    {
        $key = 'invite_resend_'.$invite->id.'_'.now()->format('Y-m-d');
        $count = Cache::increment($key);
        Cache::put($key, $count, now()->addDay());

        if ($count > 3) {
            throw ValidationException::withMessages(['invite' => ['INVITE_RESEND_THROTTLED']]);
        }

        $plainToken = Str::random(64);
        $invite->token_hash = hash('sha256', $plainToken);
        $invite->expires_at = now()->addHours((int) env('INVITE_EXPIRES_HOURS', 168));
        $invite->save();

        SendMerchantInviteEmailJob::dispatch($invite->id, $plainToken);
    }

    public function revokeInvite(MerchantInvite $invite): void
    {
        $invite->revoked_at = now();
        $invite->save();
    }
}
