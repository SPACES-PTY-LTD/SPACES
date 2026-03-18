<?php

namespace App\Jobs;

use App\Mail\MerchantInviteMail;
use App\Models\MerchantInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Mail;

class SendMerchantInviteEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $inviteId, public string $plainToken)
    {
    }

    public function handle(): void
    {
        $invite = MerchantInvite::with(['merchant', 'invitedBy'])->findOrFail($this->inviteId);

        Mail::to($invite->email)->send(new MerchantInviteMail($invite, $this->plainToken));
    }
}
