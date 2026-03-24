<?php

namespace App\Jobs;

use App\Mail\MerchantInviteMail;
use App\Models\MerchantInvite;
use App\Services\LoggedMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendMerchantInviteEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(public int $inviteId, public string $plainToken)
    {
    }

    public function handle(LoggedMailSender $loggedMailSender): void
    {
        $invite = MerchantInvite::with(['merchant', 'invitedBy'])->findOrFail($this->inviteId);

        $loggedMailSender->send(
            new MerchantInviteMail($invite, $this->plainToken),
            to: $invite->email,
            context: [
                'account_id' => $invite->account_id,
                'merchant_id' => $invite->merchant_id,
                'user_id' => $invite->invited_by_user_id,
                'related_type' => MerchantInvite::class,
                'related_id' => $invite->id,
            ],
        );
    }
}
