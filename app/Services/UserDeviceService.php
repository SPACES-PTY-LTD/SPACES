<?php

namespace App\Services;

use App\Models\User;
use App\Models\UserDevice;

class UserDeviceService
{
    public function register(User $user, array $data): UserDevice
    {
        return \Illuminate\Support\Facades\DB::transaction(function () use ($user, $data) {
            // Serialize registrations and clear previous ownership before assigning a token.
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            if (!empty($data['push_token'])) {
                UserDevice::withTrashed()->where('push_token', $data['push_token'])->where(fn ($q) => $q->where('user_id', '!=', $user->id)->orWhereNotNull('deleted_at'))->update(['push_token' => null]);
            }
            $device = $this->resolveExistingDevice($user, $data);

            if (!$device) {
                $device = new UserDevice();
                $device->user()->associate($user);
                $device->account_id = $user->account_id;
            }

            $device->fill([
                'platform' => $data['platform'] ?? $device->platform ?? 'unknown',
                'push_provider' => $data['push_provider'] ?? null,
                'push_token' => array_key_exists('push_token', $data) ? $data['push_token'] : $device->push_token,
                'device_name' => $data['device_name'] ?? null,
                'app_version' => $data['app_version'] ?? null,
                'last_seen_at' => now(),
            ]);
            $device->save();

            return $device->fresh();
        });
    }

    public function resolveForUser(User $user, ?string $deviceUuid): ?UserDevice
    {
        if (!$deviceUuid) {
            return null;
        }

        return UserDevice::where('uuid', $deviceUuid)
            ->where('user_id', $user->id)
            ->first();
    }

    private function resolveExistingDevice(User $user, array $data): ?UserDevice
    {
        $query = UserDevice::query()->where('user_id', $user->id);

        if (!empty($data['push_token'])) {
            return (clone $query)->where('push_token', $data['push_token'])->first();
        }

        if (!empty($data['platform']) || !empty($data['device_name'])) {
            return $query
                ->when(!empty($data['platform']), fn ($builder) => $builder->where('platform', $data['platform']))
                ->when(!empty($data['device_name']), fn ($builder) => $builder->where('device_name', $data['device_name']))
                ->latest('id')
                ->first();
        }

        return null;
    }
}
