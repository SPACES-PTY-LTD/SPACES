<?php

namespace App\Mail;

use App\Models\Feedback;
use App\Models\FeedbackMessage;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class FeedbackReplyMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Feedback $feedback,
        public FeedbackMessage $message,
        public User $recipient,
        public string $audience,
    ) {}

    public function build(): self
    {
        $frontendUrl = rtrim((string) env('FRONTEND_URL', 'https://example.com'), '/');
        $threadUrl = $this->audience === 'reviewer'
            ? $frontendUrl.'/admin/tools/feedback/'.$this->feedback->uuid
            : $frontendUrl.'/admin?feedback_id='.$this->feedback->uuid;

        return $this->subject('New reply to feedback: '.str_replace('_', ' ', $this->feedback->category))
            ->view('emails.feedback_reply', [
                'feedback' => $this->feedback,
                'message' => $this->message,
                'recipient' => $this->recipient,
                'threadUrl' => $threadUrl,
            ]);
    }
}
