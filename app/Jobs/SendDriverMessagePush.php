<?php

namespace App\Jobs;

use App\Models\Message;
use App\Models\UserDevice;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

class SendDriverMessagePush implements ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function __construct(public int $messageId) {}

    public function handle(): void
    {
        $message = Message::with('conversation.driver.user')->find($this->messageId);
        $conversation = $message?->conversation;
        $driver = $conversation?->driver;
        if (! $message || $conversation->type !== 'driver' || ! $driver || ! $driver->user ||
            (int) $driver->merchant_id !== (int) $conversation->merchant_id ||
            (int) $driver->account_id !== (int) $conversation->account_id ||
            (int) $message->user_id === (int) $driver->user_id) {
            return;
        }
        $devices = UserDevice::where('user_id', $driver->user_id)->where('account_id', $conversation->account_id)
            ->where('push_provider', 'expo')->whereNotNull('push_token')->get()->unique('push_token');
        foreach ($devices->chunk(100) as $chunk) {
            $devicesBatch = $chunk->values();
            $response = Http::timeout(20)->post('https://exp.host/--/api/v2/push/send', $devicesBatch->map(fn ($device) => [
                'to' => $device->push_token, 'title' => 'New message', 'body' => 'You have a new message from dispatch.',
                'sound' => 'default', 'data' => ['kind' => 'driver_message', 'conversation_id' => $conversation->uuid, 'message_id' => $message->uuid],
            ])->all())->throw();
            $receipts = [];
            foreach ($response->json('data', []) as $index => $ticket) {
                $token = $devicesBatch[$index]->push_token;
                if (($ticket['details']['error'] ?? null) === 'DeviceNotRegistered') {
                    UserDevice::where('push_token', $token)->update(['push_token' => null]);
                } elseif (($ticket['status'] ?? null) === 'ok' && isset($ticket['id'])) {
                    $receipts[$ticket['id']] = $token;
                } elseif (($ticket['details']['error'] ?? null) === 'MessageRateExceeded') {
                    throw new \RuntimeException('Push rate limit exceeded.');
                } else {
                    throw new \RuntimeException('Push provider rejected the notification.');
                }
            }
            if ($receipts) {
                CheckMessagePushReceipts::dispatch($receipts)->onConnection(config('queue.default') === 'sync' ? 'database' : config('queue.default'))->delay(now()->addMinutes(15));
            }
        }
    }
}
