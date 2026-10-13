<?php

namespace App\Services;

use App\Models\Account;
use App\Models\Driver;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

class AuthService
{
    public const ACCESS_TTL_SECONDS = 60 * 60;

    private const REFRESH_TTL_DAYS = 30;

    private const ADMIN_LOGIN_ROLES = ['user', 'super_admin'];

    public function register(array $data): array
    {
        Log::info('AuthService register started', [
            'email' => $data['email'] ?? null,
            'name' => $data['name'] ?? null,
            'has_telephone' => array_key_exists('telephone', $data) && ! empty($data['telephone']),
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
        $user = User::whereRaw('LOWER(email) = ?', [Str::lower(trim($data['email']))])->first();
        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return null;
        }

        $loginContext = $data['login_context'] ?? null;
        if ($loginContext === 'admin' && ! in_array($user->role, self::ADMIN_LOGIN_ROLES, true)) {
            return null;
        }

        if ($loginContext === 'driver' && $user->role !== 'driver') {
            return null;
        }

        $merchantUuid = null;
        if ($loginContext === 'driver') {
            $merchants = $this->driverMerchants($data['email']);
            $merchantUuid = $data['merchant_id'] ?? (count($merchants) === 1 ? $merchants[0]['merchant_id'] : null);
            if (! $merchantUuid || ! in_array($merchantUuid, array_column($merchants, 'merchant_id'), true)) {
                return null;
            }
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $token = $this->createAccessToken($user, $merchantUuid);
        $refreshToken = $this->createRefreshToken($user, ['type' => 'login', 'driver_merchant_uuid' => $merchantUuid]);

        return [
            'user' => $user,
            'token' => $token,
            'refresh_token' => $refreshToken,
            'expires_in' => self::ACCESS_TTL_SECONDS,
        ];
    }

    public function driverMerchants(string $email): array
    {
        $user = User::whereRaw('LOWER(email) = ?', [Str::lower(trim($email))])->where('role', 'driver')->first();
        if (! $user) {
            return [];
        }

        return Driver::where('user_id', $user->id)->where('account_id', $user->account_id)
            ->where('is_active', true)->whereHas('merchant', fn ($query) => $query->where('account_id', $user->account_id))
            ->with('merchant')->get()->map(fn ($driver) => [
                'merchant_id' => $driver->merchant->uuid,
                'name' => $driver->merchant->name,
            ])->unique('merchant_id')->sortBy('name')->values()->all();
    }

    public function logout(User $user, string $tokenId): void
    {
        DB::transaction(function () use ($user, $tokenId) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            $devices = \App\Models\UserDevice::where('user_id', $user->id);
            (clone $devices)->update(['push_token' => null]);
            $devices->delete();
            $user->tokens()->where('id', $tokenId)->delete();
            $user->refreshTokens()->whereNull('revoked_at')->update(['revoked_at' => now()]);
        });
    }

    public function refresh(string $refreshToken): ?array
    {
        $tokenHash = hash('sha256', $refreshToken);
        $record = RefreshToken::where('token_hash', $tokenHash)->first();

        if (! $record || $record->revoked_at || $record->expires_at->isPast()) {
            return null;
        }

        $record->update([
            'revoked_at' => now(),
            'last_used_at' => now(),
        ]);

        $user = $record->user;
        $merchantUuid = $record->meta['driver_merchant_uuid'] ?? null;
        if ($merchantUuid && ! in_array($merchantUuid, array_column($this->driverMerchants($user->email), 'merchant_id'), true)) {
            return null;
        }
        $accessToken = $this->createAccessToken($user, $merchantUuid);
        $newRefresh = $this->createRefreshToken($user, ['type' => 'refresh', 'driver_merchant_uuid' => $merchantUuid]);

        return [
            'user' => $user,
            'token' => $accessToken,
            'refresh_token' => $newRefresh,
            'expires_in' => self::ACCESS_TTL_SECONDS,
        ];
    }

    private function createAccessToken(User $user, ?string $merchantUuid = null): string
    {
        $token = $user->createToken(
            'api',
            $merchantUuid ? ['*', 'driver-merchant:'.$merchantUuid] : ['*'],
            now()->addSeconds(self::ACCESS_TTL_SECONDS)
        );
        $user->withAccessToken($token->accessToken);

        return $token->plainTextToken;
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
