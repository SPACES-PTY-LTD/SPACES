<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

class DeliverWebsiteMail implements ShouldQueue
{
    use Queueable;

    public $tries = 1;

    public $timeout = 120;

    public function __construct(public string $mailId) {}

    public function handle(\App\Services\Website\MailService $mail): void
    {
        $mail->deliver($this->mailId);
    }
}
