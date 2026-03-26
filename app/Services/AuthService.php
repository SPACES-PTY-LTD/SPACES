<?php

namespace App\Services;

use App\Models\Account;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AuthService
{
    private const REFRESH_TTL_DAYS = 30;
    private const ADMIN_LOGIN_ROLES = ['user', 'super_admin'];

    public function register(array $data): array
    {
        Log::info('AuthService register started', [
            'email' => $data['email'] ?? null,
            'name' => $data['name'] ?? null,
            'has_telephone' => array_key_exists('telephone', $data) && !empty($data['telephone']),
        ]);

        try {
            $user = DB::transaction(function () use ($data) {
                $user = User::create([
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'telephone' => $data['telephone'] ?? null,
                    'password' => $data['password'],
                    'role' => 'user',
                ]);

                Log::info('AuthService register user created', [
                    'user_id' => $user->id,
                    'user_uuid' => $user->user_uuid,
                    'email' => $user->email,
                ]);

                $account = Account::create([
                    'owner_user_id' => $user->id,
                    'country_code' => strtoupper((string) ($data['country_code'] ?? 'US')),
                    'is_billing_exempt' => false,
                ]);

                Log::info('AuthService register account created', [
                    'account_id' => $account->id,
                    'owner_user_id' => $account->owner_user_id,
                ]);

                $user->forceFill(['account_id' => $account->id])->save();

                return $user;
            });

            $token = $user->createToken('api')->plainTextToken;

            Log::info('AuthService register token created', [
                'user_id' => $user->id,
                'user_uuid' => $user->user_uuid,
            ]);

            return ['user' => $user, 'token' => $token];
        } catch (Throwable $e) {
            Log::error('AuthService register failed', [
                'email' => $data['email'] ?? null,
                'error' => $e->getMessage(),
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            throw $e;
        }
    }

    public function login(array $data): ?array
    {
        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], $user->password)) {
            return null;
        }

        $loginContext = $data['login_context'] ?? null;
        if ($loginContext === 'admin' && !in_array($user->role, self::ADMIN_LOGIN_ROLES, true)) {
            return null;
        }

        if ($loginContext === 'driver' && $user->role !== 'driver') {
            return null;
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $user->createToken('api')->plainTextToken;
        $refreshToken = $this->createRefreshToken($user, ['type' => 'login']);

        return ['user' => $user, 'token' => $token, 'refresh_token' => $refreshToken];
    }

    public function logout(User $user, string $tokenId): void
    {
        $user->tokens()->where('id', $tokenId)->delete();
        $user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
    }

    public function refresh(string $refreshToken): ?array
    {
        $tokenHash = hash('sha256', $refreshToken);
        $record = RefreshToken::where('token_hash', $tokenHash)->first();

        if (!$record || $record->revoked_at || $record->expires_at->isPast()) {
            return null;
        }

        $record->update([
            'revoked_at' => now(),
            'last_used_at' => now(),
        ]);

        $user = $record->user;
        $accessToken = $user->createToken('api')->plainTextToken;
        $newRefresh = $this->createRefreshToken($user, ['type' => 'refresh']);

        return ['user' => $user, 'token' => $accessToken, 'refresh_token' => $newRefresh];
    }

    private function createRefreshToken(User $user, array $meta = []): string
    {
        $plain = Str::random(64);
        RefreshToken::create([
            'user_id' => $user->id,
            'token_hash' => hash('sha256', $plain),
            'expires_at' => now()->addDays(self::REFRESH_TTL_DAYS),
            'meta' => $meta,
        ]);

        return $plain;
    }
}
