<?php

namespace App\Jobs;

use App\Models\MerchantInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class CleanupExpiredInvitesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function handle(): void
    {
        MerchantInvite::where('expires_at', '<', now())
            ->whereNull('accepted_at')
            ->whereNull('revoked_at')
            ->delete();
    }
}
