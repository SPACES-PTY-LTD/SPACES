<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Message;
use App\Services\ConversationService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class DriverPhoneLocationController extends Controller
{
    private function driver(Request $request): Driver
    {
        $driver = $request->user()->driver;
        abort_unless($driver && $driver->merchant
            && (int) $driver->account_id === (int) $request->user()->account_id
            && (int) $driver->merchant->account_id === (int) $driver->account_id, 403, 'Driver merchant not found.');

        return $driver;
    }

    private function settings(Driver $driver): array
    {
        $phone = $driver->metadata['phone_location'] ?? [];

        return [
            'enabled' => (bool) ($phone['enabled'] ?? false),
            'last_reported_at' => $phone['reported_at'] ?? null,
            'dispatch_alerted_at' => $phone['dispatch_alerted_at'] ?? null,
        ];
    }

    public function show(Request $request)
    {
        return ApiResponse::success($this->settings($this->driver($request)));
    }

    public function update(Request $request, ConversationService $conversations)
    {
        $data = $request->validate(['enabled' => ['required', 'boolean']]);
        $driver = $this->driver($request);
        $driver = DB::transaction(function () use ($driver, $data, $request, $conversations) {
            $driver = Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $metadata = $driver->metadata ?? [];
            $phone = $metadata['phone_location'] ?? [];
            $enabled = (bool) $data['enabled'];
            if (! $enabled && ($phone['enabled'] ?? false)) {
                // Commit the preference and the dispatch inbox alert together; retries do not duplicate it.
                $chat = $conversations->driverChat($request->user(), $driver->merchant, null);
                Message::create([
                    'account_id' => $driver->account_id, 'merchant_id' => $driver->merchant_id,
                    'conversation_id' => $chat->id, 'user_id' => $driver->user_id, 'type' => 'text',
                    'body' => 'Phone location sharing was turned off. Dispatch has been alerted. Phone location updates are paused.',
                ]);
                $chat->touch();
                $phone['dispatch_alerted_at'] = now()->toIso8601String();
            }
            $phone['enabled'] = $enabled;
            if (! $enabled) {
                // Do not retain a phone coordinate after the driver withdraws sharing consent.
                unset($phone['latitude'], $phone['longitude'], $phone['accuracy']);
            }
            $metadata['phone_location'] = $phone;
            $driver->update(['metadata' => $metadata]);

            return $driver;
        });

        return ApiResponse::success($this->settings($driver));
    }

    public function report(Request $request)
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0'],
            'observed_at' => ['required', 'date', 'before_or_equal:'.now()->addMinute()->toIso8601String(), 'after_or_equal:'.now()->subMinutes(5)->toIso8601String()],
        ]);
        $driver = $this->driver($request);

        return DB::transaction(function () use ($driver, $data) {
            $driver = Driver::whereKey($driver->id)->lockForUpdate()->firstOrFail();
            $metadata = $driver->metadata ?? [];
            $phone = $metadata['phone_location'] ?? [];
            abort_unless($phone['enabled'] ?? false, 409, 'Phone location sharing is off.');
            $observed = Carbon::parse($data['observed_at']);
            if (empty($phone['reported_at']) || $observed->gt(Carbon::parse($phone['reported_at']))) {
                $metadata['phone_location'] = array_merge($phone, [
                    'latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude'],
                    'accuracy' => $data['accuracy'] ?? null, 'reported_at' => $observed->toIso8601String(),
                ]);
                $driver->update(['metadata' => $metadata]);
            }

            return ApiResponse::success($this->settings($driver));
        });
    }
}
