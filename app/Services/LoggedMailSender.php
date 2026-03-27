<?php

namespace App\Services;

use App\Models\EmailLog;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Facades\Mail;
use Throwable;

class LoggedMailSender
{
    public function send(
        Mailable $mailable,
        array|string $to,
        array|string|null $cc = null,
        array|string|null $bcc = null,
        array $context = [],
    ): EmailLog {
        $mailer = $context['mailer'] ?? config('mail.default');
        $subject = $this->resolveSubject($mailable);
        $htmlMessage = $this->renderMessageBody($mailable);
        $from = $this->resolveFrom($mailable);

        $emailLog = EmailLog::create([
            'account_id' => $context['account_id'] ?? null,
            'merchant_id' => $context['merchant_id'] ?? null,
            'environment_id' => $context['environment_id'] ?? null,
            'user_id' => $context['user_id'] ?? null,
            'related_type' => $context['related_type'] ?? null,
            'related_id' => $context['related_id'] ?? null,
            'status' => EmailLog::STATUS_PENDING,
            'mailer' => $mailer,
            'mailable' => $mailable::class,
            'from_email' => $from['email'],
            'from_name' => $from['name'],
            'to' => $this->normalizeRecipients($to),
            'cc' => $this->normalizeRecipients($cc),
            'bcc' => $this->normalizeRecipients($bcc),
            'subject' => $subject,
            'html_message' => $htmlMessage,
        ]);

        try {
            $pendingMail = Mail::mailer($mailer)->to($to);

            if ($cc !== null && $cc !== []) {
                $pendingMail->cc($cc);
            }

            if ($bcc !== null && $bcc !== []) {
                $pendingMail->bcc($bcc);
            }

            $sentMessage = $pendingMail->send($mailable);

            $emailLog->forceFill([
                'status' => EmailLog::STATUS_SENT,
                'subject' => $this->resolveSubject($mailable) ?? $subject,
                'html_message' => $this->renderMessageBody($mailable) ?? $htmlMessage,
                'message_id' => $sentMessage?->getMessageId(),
                'sent_at' => now(),
                'error_message' => null,
            ])->save();

            return $emailLog;
        } catch (Throwable $exception) {
            $emailLog->forceFill([
                'status' => EmailLog::STATUS_FAILED,
                'subject' => $this->resolveSubject($mailable) ?? $subject,
                'html_message' => $this->renderMessageBody($mailable) ?? $htmlMessage,
                'error_message' => $exception->getMessage(),
                'failed_at' => now(),
            ])->save();

            throw $exception;
        }
    }

    protected function normalizeRecipients(array|string|null $recipients): ?array
    {
        if ($recipients === null) {
            return null;
        }

        if (is_string($recipients)) {
            return [[
                'email' => $recipients,
                'name' => null,
            ]];
        }

        if (array_is_list($recipients)) {
            return array_map(function ($recipient): array {
                if (is_string($recipient)) {
                    return [
                        'email' => $recipient,
                        'name' => null,
                    ];
                }

                return [
                    'email' => $recipient['email'] ?? $recipient['address'] ?? null,
                    'name' => $recipient['name'] ?? null,
                ];
            }, $recipients);
        }

        return [[
            'email' => $recipients['email'] ?? $recipients['address'] ?? null,
            'name' => $recipients['name'] ?? null,
        ]];
    }

    protected function resolveSubject(Mailable $mailable): ?string
    {
        if (! empty($mailable->subject)) {
            return $mailable->subject;
        }

        if (method_exists($mailable, 'envelope')) {
            $subject = $mailable->envelope()?->subject;

            if (! empty($subject)) {
                return $subject;
            }
        }

        if (method_exists($mailable, 'build')) {
            $clone = clone $mailable;
            $clone->build();

            return $clone->subject;
        }

        return null;
    }

    protected function renderMessageBody(Mailable $mailable): ?string
    {
        $clone = clone $mailable;

        return rescue(
            static fn (): string => $clone->render(),
            report: false,
        );
    }

    protected function resolveFrom(Mailable $mailable): array
    {
        $clone = clone $mailable;

        rescue(
            static fn (): string => $clone->render(),
            report: false,
        );

        $from = $clone->from[0] ?? null;

        return [
            'email' => $from['address'] ?? config('mail.from.address'),
            'name' => $from['name'] ?? config('mail.from.name'),
        ];
    }
}
