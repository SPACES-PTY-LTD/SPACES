<?php

namespace App\Jobs;

use App\Models\UserDevice;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;

class CheckMessagePushReceipts implements ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    public function backoff(): array
    {
        return [60, 300, 900];
    }

    public function __construct(public array $receipts) {}

    public function handle(): void
    {
        $data = Http::timeout(20)->post('https://exp.host/--/api/v2/push/getReceipts', ['ids' => array_keys($this->receipts)])->throw()->json('data', []);
        foreach ($data as $id => $receipt) {
            if (($receipt['details']['error'] ?? null) === 'DeviceNotRegistered' && isset($this->receipts[$id])) {
                UserDevice::where('push_token', $this->receipts[$id])->update(['push_token' => null]);
            }
        }
        if (count($data) < count($this->receipts)) {
            throw new \RuntimeException('Push receipts are not available yet.');
        }
    }
}
