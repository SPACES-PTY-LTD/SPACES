<?php

namespace Tests\Feature;

use App\Jobs\SendDriverMessagePush;
use App\Models\Account;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ConversationPushCommitTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->artisan('migrate:fresh');
    }

    protected function tearDown(): void
    {
        // Existing unrelated migration down() methods are not SQLite-compatible.
        $this->artisan('migrate:fresh');
        parent::tearDown();
    }

    public function test_push_is_dispatched_only_after_commit_and_retry_is_not_redispatched(): void
    {
        Queue::fake();
        $owner = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id]);
        $driver = User::factory()->create(['role' => 'driver', 'account_id' => $account->id]);
        $profile = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $driver->id]);
        $headers = ['Authorization' => 'Bearer '.$owner->createToken('commit-test')->plainTextToken];
        $id = $this->postJson('/api/v1/conversations/driver', ['merchant_id' => $merchant->uuid, 'driver_id' => $profile->uuid], $headers)->assertOk()->json('data.conversation_id');
        DB::beginTransaction();
        $this->postJson("/api/v1/conversations/$id/messages", ['body' => 'After commit', 'temporary_id' => 'commit'], $headers)->assertCreated();
        Queue::assertNothingPushed();
        DB::commit();
        Queue::assertPushed(SendDriverMessagePush::class, 1);
        $this->postJson("/api/v1/conversations/$id/messages", ['body' => 'After commit', 'temporary_id' => 'commit'], $headers)->assertOk();
        Queue::assertPushed(SendDriverMessagePush::class, 1);
        DB::beginTransaction();
        $this->postJson("/api/v1/conversations/$id/messages", ['body' => 'Rollback', 'temporary_id' => 'rollback'], $headers)->assertCreated();
        DB::rollBack();
        Queue::assertPushed(SendDriverMessagePush::class, 1);
        $this->assertDatabaseCount('messages', 1);
    }
}
