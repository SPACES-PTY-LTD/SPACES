<?php

namespace App\Services\Website;

use App\Models\Website\OutboundMail;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class MailService
{
    public function queue(string $recipient, string $subject, string $body, ?string $calendar = null): void
    {
        OutboundMail::create(compact('recipient', 'subject', 'body', 'calendar'));
    }

    public function deliver(string $id): void
    {
        $mail = DB::transaction(function () use ($id) {
            $mail = OutboundMail::lockForUpdate()->find($id);
            if (! $mail || in_array($mail->status, ['sent', 'sending']) || $mail->attempts >= 5) {
                return null;
            }
            $mail->update(['status' => 'sending', 'attempts' => $mail->attempts + 1, 'attempted_at' => now()]);

            return $mail;
        });
        if (! $mail) {
            return;
        }
        try {
            Mail::raw($mail->body, function ($message) use ($mail) {
                $message->to($mail->recipient)->subject($mail->subject);
                if ($mail->calendar) {
                    $message->attachData($mail->calendar, 'demo.ics', ['mime' => 'text/calendar']);
                }
            });
            $mail->update(['status' => 'sent', 'error' => null]);
        } catch (\Throwable $e) {
            // Do not expose SMTP secrets or message bodies in the administration API.
            $mail->update(['status' => 'failed', 'error' => 'Email delivery failed. Check mail configuration and worker logs.']);
            report($e);
        }
    }
}
