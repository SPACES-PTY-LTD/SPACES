<?php

namespace App\Jobs;

use App\Mail\FeedbackReplyMail;
use App\Models\Feedback;
use App\Models\FeedbackMessage;
use App\Models\User;
use App\Services\LoggedMailSender;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;

class SendFeedbackReplyEmailJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public int $feedbackId,
        public int $messageId,
        public int $recipientUserId,
        public string $audience,
    ) {}

    public function handle(LoggedMailSender $loggedMailSender): void
    {
        $feedback = Feedback::with(['merchant', 'submitter', 'assignee'])->findOrFail($this->feedbackId);
        $message = FeedbackMessage::with('sender')
            ->where('feedback_id', $feedback->id)
            ->findOrFail($this->messageId);
        $recipient = User::findOrFail($this->recipientUserId);

        $loggedMailSender->send(
            new FeedbackReplyMail($feedback, $message, $recipient, $this->audience),
            to: ['email' => $recipient->email, 'name' => $recipient->name],
            context: [
                'account_id' => $feedback->account_id,
                'merchant_id' => $feedback->merchant_id,
                'user_id' => $recipient->id,
                'related_type' => Feedback::class,
                'related_id' => $feedback->id,
            ],
        );
    }
}
