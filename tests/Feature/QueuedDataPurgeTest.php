<?php

namespace Tests\Feature;

use App\Jobs\PurgeMerchantDataJob;
use App\Models\Account;
use App\Models\DataPurge;
use App\Models\Merchant;
use App\Models\User;
use App\Services\DataPurgeService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class QueuedDataPurgeTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    private Merchant $merchant;

    protected function setUp(): void
    {
        parent::setUp();
        config(['queue.default' => 'database']);
        Queue::fake();
        $this->owner = User::factory()->create(['password' => 'password']);
        $account = Account::create(['owner_user_id' => $this->owner->id]);
        $this->owner->update(['account_id' => $account->id]);
        $this->merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $this->owner->id]);
        $this->withToken($this->owner->createToken('test')->plainTextToken);
    }

    private function endpoint(): string
    {
        return "/api/v1/merchants/{$this->merchant->uuid}/purge-data";
    }

    private function submit(string $password = 'password')
    {
        return $this->postJson($this->endpoint(), [
            'merchant_id' => $this->merchant->uuid,
            'password' => $password,
            'types' => ['activity_logs'],
        ]);
    }

    public function test_request_queues_without_running_and_duplicate_returns_same_operation(): void
    {
        $this->mock(DataPurgeService::class)->shouldNotReceive('purgeIncrementally');
        $response = $this->submit()->assertAccepted()->assertJsonPath('data.status', 'queued');
        $uuid = $response->json('data.job_id');
        $this->submit()->assertAccepted()->assertJsonPath('data.job_id', $uuid);
        Queue::assertPushed(PurgeMerchantDataJob::class, 1);
        Queue::assertPushed(PurgeMerchantDataJob::class, function ($job) {
            $this->assertStringNotContainsString('password', serialize($job));

            return true;
        });
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('data.job_id', $uuid);
        $this->assertDatabaseCount('data_purges', 1);
    }

    public function test_worker_persists_result_and_redelivery_does_not_repeat_deletion(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $job = new PurgeMerchantDataJob($purge->id);
        $job->handle(app(DataPurgeService::class));
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('data.status', 'completed')
            ->assertJsonPath('data.result.processed_types.0', 'activity_logs');
        $this->assertNull($purge->fresh()->active_merchant_id);
        $service = $this->mock(DataPurgeService::class);
        $service->shouldNotReceive('purgeIncrementally');
        $job->handle($service);
        // A fresh request is allowed after completion.
        $this->submit()->assertAccepted();
        $this->assertDatabaseCount('data_purges', 2);
    }

    public function test_worker_preserves_committed_changes_and_exposes_safe_failure(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $service = $this->mock(DataPurgeService::class);
        $service->shouldReceive('purgeIncrementally')->once()->andReturnUsing(function () {
            $this->merchant->update(['name' => 'must roll back']);
            throw new \RuntimeException('private database details');
        });
        $job = new PurgeMerchantDataJob($purge->id);
        try {
            $job->handle($service);
            $this->fail('Expected failure');
        } catch (\RuntimeException $e) {
            $job->failed($e);
        }
        $this->assertSame('must roll back', $this->merchant->fresh()->name);
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('data.status', 'failed')
            ->assertDontSee('private database details');
        $this->assertNull($purge->fresh()->active_merchant_id);
    }

    public function test_password_and_owner_checks_apply_to_submission_and_monitoring(): void
    {
        $this->submit('wrong')->assertUnauthorized();
        Queue::assertNothingPushed();
        $this->getJson($this->endpoint())->assertOk()->assertJsonPath('data', null);
        $this->submit()->assertAccepted();
        $uuid = DataPurge::firstOrFail()->uuid;
        $otherMerchant = Merchant::factory()->create(['account_id' => $this->merchant->account_id]);
        $this->getJson("/api/v1/merchants/{$otherMerchant->uuid}/purge-data/{$uuid}")->assertNotFound();
        $otherUser = User::factory()->create(['account_id' => $this->merchant->account_id]);
        $this->withToken($otherUser->createToken('test')->plainTextToken);
        $this->getJson($this->endpoint())->assertForbidden();
        $this->submit()->assertForbidden();
    }

    public function test_sync_queue_is_rejected_instead_of_timing_out_http_request(): void
    {
        config(['queue.default' => 'sync']);
        $this->submit()->assertStatus(503)->assertJsonPath('error.code', 'PURGE_QUEUE_UNAVAILABLE');
        Queue::assertNothingPushed();
    }

    public function test_timeout_releases_active_slot_but_cannot_overwrite_success(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $job = new PurgeMerchantDataJob($purge->id);
        $job->failed(new \Illuminate\Queue\TimeoutExceededException('timeout'));
        $this->assertSame('failed', $purge->fresh()->status);
        $this->assertNull($purge->fresh()->active_merchant_id);
        $purge->update(['status' => 'completed']);
        $job->failed(new \RuntimeException('late failure'));
        $this->assertSame('completed', $purge->fresh()->status);
    }

    public function test_progress_reports_processed_types_but_only_completion_reaches_the_end(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $purge->update(['status' => 'running']);
        $seen = [];
        app(DataPurgeService::class)->purge($this->owner, $this->merchant, ['activity_logs', 'api_call_logs'],
            function ($done, $total, $current, $orderedTypes) use ($purge, &$seen) {
                app(\App\Services\DataPurgeProgress::class)->write($purge->uuid, $done, $total, $current, $orderedTypes);
                $seen[] = $purge->toStatus()['progress'];
            });
        $this->assertSame([0, 1, 2], array_column($seen, 'completed_types'));
        $this->assertSame(['api_call_logs', 'activity_logs', null], array_column($seen, 'current_type'));
        $this->assertSame([0, 33, 66], array_column($seen, 'percent'));
        $this->assertSame([[], ['api_call_logs'], ['api_call_logs', 'activity_logs']], array_column($seen, 'processed_types'));
        $this->assertSame(['api_call_logs', 'activity_logs'], $seen[0]['ordered_types']);
        $this->getJson($this->endpoint())->assertJsonPath('data.progress.completed_types', 2);
        $purge->update(['status' => 'failed']);
        $this->getJson($this->endpoint())->assertJsonPath('data.progress', null);
        $purge->update(['status' => 'completed']);
        $this->getJson($this->endpoint())->assertJsonPath('data.progress', null);
    }

    public function test_cancelling_queued_job_skips_deletion_and_releases_slot(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $this->postJson($this->endpoint()."/{$purge->uuid}/cancel")
            ->assertOk()->assertJsonPath('data.cancel_requested', true);
        $service = $this->mock(DataPurgeService::class);
        $service->shouldNotReceive('purgeIncrementally');
        (new PurgeMerchantDataJob($purge->id))->handle($service);
        $this->getJson($this->endpoint())->assertJsonPath('data.status', 'cancelled')
            ->assertJsonPath('data.progress', null)->assertJsonPath('data.cancel_requested', false);
        $this->assertNull($purge->fresh()->active_merchant_id);
        $this->postJson($this->endpoint()."/{$purge->uuid}/cancel")->assertJsonPath('data.status', 'cancelled');
    }

    public function test_running_cancellation_preserves_committed_changes_at_final_checkpoint(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        $service = $this->mock(DataPurgeService::class);
        $service->shouldReceive('purgeIncrementally')->once()->andReturnUsing(function () use ($purge) {
            $this->merchant->update(['name' => 'must roll back']);
            app(\App\Services\DataPurgeCancellation::class)->request($purge->uuid);

            return [];
        });
        (new PurgeMerchantDataJob($purge->id))->handle($service);
        $this->assertSame('must roll back', $this->merchant->fresh()->name);
        $this->assertSame('cancelled', $purge->fresh()->status);
        $this->assertNull($purge->fresh()->result);
    }

    public function test_cancel_is_owner_and_merchant_scoped_and_cannot_undo_completion(): void
    {
        $this->submit()->assertAccepted();
        $purge = DataPurge::firstOrFail();
        (new PurgeMerchantDataJob($purge->id))->handle(app(DataPurgeService::class));
        $this->postJson($this->endpoint()."/{$purge->uuid}/cancel")
            ->assertOk()->assertJsonPath('data.status', 'completed')->assertJsonPath('data.cancel_requested', false);
        $this->assertDatabaseCount('data_purge_cancellations', 0);
        $otherMerchant = Merchant::factory()->create(['account_id' => $this->merchant->account_id]);
        $this->postJson("/api/v1/merchants/{$otherMerchant->uuid}/purge-data/{$purge->uuid}/cancel")->assertNotFound();
        $otherUser = User::factory()->create(['account_id' => $this->merchant->account_id]);
        $this->withToken($otherUser->createToken('test')->plainTextToken);
        $this->postJson($this->endpoint()."/{$purge->uuid}/cancel")->assertForbidden();
    }
}
