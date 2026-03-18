<?php

namespace App\Mail;

use App\Models\MerchantInvite;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class MerchantInviteMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public MerchantInvite $invite, public string $plainToken)
    {
    }

    public function build(): self
    {
        $frontendUrl = rtrim((string) env('FRONTEND_URL', 'https://example.com'), '/');
        $acceptUrl = $frontendUrl.'/auth/invites?token='.$this->plainToken;

        return $this->subject('You have been invited to join '.$this->invite->merchant->name)
            ->view('emails.merchant_invite', [
                'invite' => $this->invite,
                'acceptUrl' => $acceptUrl,
            ]);
    }
}
