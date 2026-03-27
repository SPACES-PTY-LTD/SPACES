<?php

namespace Tests\Feature;

use App\Mail\MerchantInviteMail;
use App\Models\Account;
use App\Models\EmailLog;
use App\Models\Merchant;
use App\Models\MerchantInvite;
use App\Models\User;
use App\Services\LoggedMailSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use RuntimeException;
use Tests\TestCase;

class EmailLogTest extends TestCase
{
    use RefreshDatabase;

    public function test_logged_mail_sender_records_sent_email(): void
    {
        Mail::fake();
        config()->set('mail.invite_from.address', 'invites@example.com');
        config()->set('mail.invite_from.name', 'Invites');

        [$account, $merchant, $owner] = $this->createMerchantContext();

        $invite = MerchantInvite::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'invited_by_user_id' => $owner->id,
            'email' => 'invitee@example.com',
            'role' => 'developer',
            'token_hash' => hash('sha256', 'plain-token'),
            'expires_at' => now()->addDay(),
        ]);

        app(LoggedMailSender::class)->send(
            new MerchantInviteMail($invite->load(['merchant', 'invitedBy']), 'plain-token'),
            to: $invite->email,
            context: [
                'account_id' => $invite->account_id,
                'merchant_id' => $invite->merchant_id,
                'user_id' => $invite->invited_by_user_id,
                'related_type' => MerchantInvite::class,
                'related_id' => $invite->id,
            ],
        );

        Mail::assertSent(MerchantInviteMail::class);

        $this->assertDatabaseHas('email_logs', [
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'user_id' => $owner->id,
            'related_type' => MerchantInvite::class,
            'related_id' => $invite->id,
            'status' => EmailLog::STATUS_SENT,
            'mailable' => MerchantInviteMail::class,
            'from_email' => 'invites@example.com',
            'from_name' => 'Invites',
            'subject' => 'You have been invited to join '.$merchant->name,
        ]);

        $emailLog = EmailLog::firstOrFail();

        $this->assertSame([[
            'email' => 'invitee@example.com',
            'name' => null,
        ]], $emailLog->to);
        $this->assertStringContainsString($merchant->name, (string) $emailLog->html_message);
        $this->assertStringContainsString('/auth/invites?token=plain-token', (string) $emailLog->html_message);
        $this->assertNull($emailLog->failed_at);
        $this->assertNotNull($emailLog->sent_at);
    }

    public function test_logged_mail_sender_records_failed_email(): void
    {
        config()->set('mail.invite_from.address', 'invites@example.com');
        config()->set('mail.invite_from.name', 'Invites');
        Mail::shouldReceive('mailer')->once()->with(config('mail.default'))->andReturnSelf();
        Mail::shouldReceive('to')->once()->with('invitee@example.com')->andReturnSelf();
        Mail::shouldReceive('send')->once()->andThrow(new RuntimeException('SMTP unavailable'));

        [$account, $merchant, $owner] = $this->createMerchantContext();

        $invite = MerchantInvite::create([
            'account_id' => $account->id,
            'merchant_id' => $merchant->id,
            'invited_by_user_id' => $owner->id,
            'email' => 'invitee@example.com',
            'role' => 'developer',
            'token_hash' => hash('sha256', 'plain-token'),
            'expires_at' => now()->addDay(),
        ]);

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('SMTP unavailable');

        try {
            app(LoggedMailSender::class)->send(
                new MerchantInviteMail($invite->load(['merchant', 'invitedBy']), 'plain-token'),
                to: $invite->email,
                context: [
                    'account_id' => $invite->account_id,
                    'merchant_id' => $invite->merchant_id,
                    'user_id' => $invite->invited_by_user_id,
                    'related_type' => MerchantInvite::class,
                    'related_id' => $invite->id,
                ],
            );
        } finally {
            $this->assertDatabaseHas('email_logs', [
                'account_id' => $account->id,
                'merchant_id' => $merchant->id,
                'user_id' => $owner->id,
                'related_type' => MerchantInvite::class,
                'related_id' => $invite->id,
                'status' => EmailLog::STATUS_FAILED,
                'mailable' => MerchantInviteMail::class,
                'error_message' => 'SMTP unavailable',
            ]);

            $emailLog = EmailLog::firstOrFail();

            $this->assertSame('invites@example.com', $emailLog->from_email);
            $this->assertSame('Invites', $emailLog->from_name);
            $this->assertNull($emailLog->sent_at);
            $this->assertNotNull($emailLog->failed_at);
        }
    }

    protected function createMerchantContext(): array
    {
        $owner = User::factory()->create();
        $account = Account::create([
            'owner_user_id' => $owner->id,
        ]);

        $owner->update([
            'account_id' => $account->id,
        ]);

        $merchant = Merchant::factory()->create([
            'account_id' => $account->id,
            'owner_user_id' => $owner->id,
        ]);

        return [$account, $merchant, $owner];
    }
}
