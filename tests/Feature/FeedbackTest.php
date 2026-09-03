<?php

namespace Tests\Feature;

use App\Jobs\SendFeedbackReplyEmailJob;
use App\Models\Account;
use App\Models\Feedback;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class FeedbackTest extends TestCase
{
    use RefreshDatabase;

    private function apiFor(User $user): self
    {
        return $this->withHeader('Authorization', 'Bearer '.$user->createToken('feedback-tests')->plainTextToken);
    }

    private function accountContext(string $membershipRole = 'admin'): array
    {
        $owner = User::factory()->create();
        $account = Account::query()->create(['owner_user_id' => $owner->id]);
        $owner->forceFill(['account_id' => $account->id])->save();
        $merchant = Merchant::factory()->create([
            'owner_user_id' => $owner->id,
            'account_id' => $account->id,
        ]);
        $owner->merchants()->attach($merchant->id, ['role' => $membershipRole]);

        return [$owner, $account, $merchant];
    }

    private function submit(User $user, Merchant $merchant, array $overrides = [])
    {
        return $this->apiFor($user)->postJson('/api/v1/feedback', array_merge([
            'merchant_id' => $merchant->uuid,
            'category' => 'bug',
            'message' => 'The shipment filter is not retaining its value.',
            'page_path' => '/admin/logistics/shipments',
        ], $overrides));
    }

    public function test_admin_user_can_submit_feedback_with_server_derived_context(): void
    {
        [$user, $account, $merchant] = $this->accountContext();

        $response = $this->submit($user, $merchant)
            ->assertCreated()
            ->assertJsonPath('data.category', 'bug')
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.submitter.user_id', $user->uuid)
            ->assertJsonPath('data.merchant.merchant_id', $merchant->uuid)
            ->assertJsonPath('data.page_path', '/admin/logistics/shipments')
            ->assertJsonPath('data.messages.0.body', 'The shipment filter is not retaining its value.');

        $feedback = Feedback::query()->where('uuid', $response->json('data.feedback_id'))->firstOrFail();
        $this->assertSame($account->id, $feedback->account_id);
        $this->assertSame($user->id, $feedback->submitted_by_user_id);
    }

    public function test_feedback_submission_validates_category_message_page_and_merchant_access(): void
    {
        [$user, , $merchant] = $this->accountContext();
        [, , $otherMerchant] = $this->accountContext();

        $this->postJson('/api/v1/feedback', [])->assertUnauthorized();

        $this->submit($user, $merchant, [
            'category' => 'complaint',
            'message' => '   ',
            'page_path' => '/auth/login',
        ])->assertUnprocessable();

        $this->submit($user, $otherMerchant)->assertForbidden();
        $driver = User::factory()->create(['role' => 'driver']);
        $this->submit($driver, $merchant)->assertForbidden();
    }

    public function test_submitter_only_lists_and_reads_their_own_feedback(): void
    {
        [$user, $account, $merchant] = $this->accountContext();
        $other = User::factory()->create(['account_id' => $account->id]);
        $merchant->users()->attach($other->id, ['role' => 'developer']);

        $feedbackId = $this->submit($user, $merchant)->json('data.feedback_id');
        $this->submit($other, $merchant, ['message' => 'Another thread'])->assertCreated();

        $this->apiFor($user)->getJson('/api/v1/feedback/mine')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.feedback_id', $feedbackId);

        $otherId = Feedback::query()->where('submitted_by_user_id', $other->id)->value('uuid');
        $this->apiFor($user)->getJson('/api/v1/feedback/'.$otherId)->assertNotFound();
    }

    public function test_submitter_can_edit_their_original_feedback_without_changing_context_or_replies(): void
    {
        [$submitter, $account, $merchant] = $this->accountContext();
        $otherUser = User::factory()->create(['account_id' => $account->id]);
        $feedbackId = $this->submit($submitter, $merchant)->json('data.feedback_id');
        $feedback = Feedback::query()->where('uuid', $feedbackId)->firstOrFail();
        $feedback->forceFill(['status' => 'in_progress'])->save();
        $feedback->messages()->create([
            'sender_user_id' => $otherUser->id,
            'author_type' => 'reviewer',
            'body' => 'We are looking into this.',
        ]);

        $this->apiFor($otherUser)->patchJson('/api/v1/feedback/'.$feedbackId, [
            'category' => 'general',
            'message' => 'This should not be allowed.',
        ])->assertNotFound();

        $this->apiFor($submitter)->patchJson('/api/v1/feedback/'.$feedbackId, [
            'category' => 'feature_request',
            'message' => '  Please retain the shipment filter value.  ',
        ])->assertOk()
            ->assertJsonPath('data.category', 'feature_request')
            ->assertJsonPath('data.status', 'in_progress')
            ->assertJsonPath('data.page_path', '/admin/logistics/shipments')
            ->assertJsonPath('data.messages.0.body', 'Please retain the shipment filter value.')
            ->assertJsonPath('data.messages.1.body', 'We are looking into this.');

        $this->assertDatabaseHas('feedback', [
            'uuid' => $feedbackId,
            'category' => 'feature_request',
            'page_path' => '/admin/logistics/shipments',
        ]);
        $this->assertSame(2, $feedback->messages()->count());

        $this->apiFor($submitter)->patchJson('/api/v1/feedback/'.$feedbackId, [
            'category' => 'invalid',
            'message' => '   ',
        ])->assertUnprocessable();
    }

    public function test_reviewer_scope_includes_all_manageable_merchants_and_excludes_other_roles(): void
    {
        [$owner, $account, $merchantA] = $this->accountContext();
        $merchantB = Merchant::factory()->create(['owner_user_id' => $owner->id, 'account_id' => $account->id]);
        $outsider = User::factory()->create();
        $outsideMerchant = Merchant::factory()->create(['owner_user_id' => $outsider->id]);

        $this->submit($owner, $merchantA);
        $this->submit($owner, $merchantB, ['message' => 'Second merchant']);

        $outsideMerchant->users()->attach($outsider->id, ['role' => 'admin']);
        $this->submit($outsider, $outsideMerchant, ['message' => 'Outside account']);

        $this->apiFor($owner)->getJson('/api/v1/admin/feedback')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $modifier = User::factory()->create(['account_id' => $account->id]);
        $merchantA->users()->attach($modifier->id, ['role' => 'developer']);
        $this->apiFor($modifier)->getJson('/api/v1/admin/feedback')->assertForbidden();

        $super = User::factory()->create(['role' => 'super_admin']);
        $this->apiFor($super)->getJson('/api/v1/admin/feedback')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    public function test_read_receipts_status_transitions_assignment_and_reply_mail_routing(): void
    {
        Queue::fake();
        [$submitter, $account, $merchant] = $this->accountContext();
        $reviewer = User::factory()->create(['account_id' => $account->id]);
        $merchant->users()->attach($reviewer->id, ['role' => 'admin']);
        $feedbackId = $this->submit($submitter, $merchant)->json('data.feedback_id');

        $this->apiFor($reviewer)->getJson('/api/v1/admin/feedback/unread-count')
            ->assertOk()
            ->assertJsonPath('data.count', 1);

        $this->apiFor($reviewer)->postJson('/api/v1/admin/feedback/'.$feedbackId.'/read')
            ->assertOk();
        $this->apiFor($reviewer)->getJson('/api/v1/admin/feedback/unread-count')
            ->assertJsonPath('data.count', 0);

        $this->apiFor($reviewer)->postJson('/api/v1/admin/feedback/'.$feedbackId.'/replies', [
            'message' => 'Please provide the affected shipment reference.',
            'status' => 'needs_info',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'needs_info')
            ->assertJsonPath('data.assignee.user_id', $reviewer->uuid);

        Queue::assertPushed(SendFeedbackReplyEmailJob::class, fn ($job) => $job->recipientUserId === $submitter->id && $job->audience === 'submitter'
        );

        $this->apiFor($submitter)->getJson('/api/v1/feedback/unread-count')
            ->assertJsonPath('data.count', 1);

        $this->apiFor($submitter)->postJson('/api/v1/feedback/'.$feedbackId.'/replies', [
            'message' => 'It is shipment REF-100.',
        ])->assertCreated()->assertJsonPath('data.status', 'in_progress');

        Queue::assertPushed(SendFeedbackReplyEmailJob::class, fn ($job) => $job->recipientUserId === $reviewer->id && $job->audience === 'reviewer'
        );

        $this->apiFor($reviewer)->patchJson('/api/v1/admin/feedback/'.$feedbackId, [
            'status' => 'closed',
        ])->assertOk()->assertJsonPath('data.status', 'closed');

        $this->apiFor($submitter)->postJson('/api/v1/feedback/'.$feedbackId.'/replies', [
            'message' => 'This is still happening.',
        ])->assertCreated()->assertJsonPath('data.status', 'open');
    }

    public function test_reviewer_filters_feedback_by_status_category_assignment_merchant_and_search(): void
    {
        [$reviewer, , $merchant] = $this->accountContext();
        $feedbackId = $this->submit($reviewer, $merchant, [
            'category' => 'feature_request',
            'message' => 'Please add a compact dashboard view.',
            'page_path' => '/admin',
        ])->json('data.feedback_id');

        $this->apiFor($reviewer)->patchJson('/api/v1/admin/feedback/'.$feedbackId, ['assignment' => 'self']);

        $this->apiFor($reviewer)->getJson('/api/v1/admin/feedback?'.http_build_query([
            'status' => 'open',
            'category' => 'feature_request',
            'assigned_to' => 'me',
            'merchant_id' => $merchant->uuid,
            'search' => 'compact dashboard',
        ]))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_submitter_can_soft_delete_their_feedback_without_deleting_messages(): void
    {
        [$submitter, $account, $merchant] = $this->accountContext();
        $otherUser = User::factory()->create(['account_id' => $account->id]);
        $feedbackId = $this->submit($submitter, $merchant)->json('data.feedback_id');
        $feedback = Feedback::query()->where('uuid', $feedbackId)->firstOrFail();
        $messageCount = DB::table('feedback_messages')->where('feedback_id', $feedback->id)->count();

        $this->apiFor($otherUser)->deleteJson('/api/v1/feedback/'.$feedbackId)->assertNotFound();

        $this->apiFor($submitter)->deleteJson('/api/v1/feedback/'.$feedbackId)
            ->assertOk()
            ->assertJsonPath('data.message', 'Feedback deleted.');

        $this->assertSoftDeleted('feedback', ['uuid' => $feedbackId]);
        $this->assertSame(
            $messageCount,
            DB::table('feedback_messages')->where('feedback_id', $feedback->id)->count()
        );
        $this->apiFor($submitter)->getJson('/api/v1/feedback/mine')->assertJsonCount(0, 'data');
        $this->apiFor($submitter)->getJson('/api/v1/admin/feedback')->assertJsonCount(0, 'data');
        $this->apiFor($submitter)->getJson('/api/v1/feedback/'.$feedbackId)->assertNotFound();
    }
}
