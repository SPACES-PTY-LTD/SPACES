<?php

namespace Tests\Feature;

use App\Models\Account;
use App\Models\ActivityLog;
use App\Models\Conversation;
use App\Models\Driver;
use App\Models\Location;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ConversationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use Tests\TestCase;

class DriverRunActionsTest extends TestCase
{
    use RefreshDatabase;

    private function context(): array
    {
        $owner = User::factory()->create(['role' => 'user']);
        $account = Account::create(['owner_user_id' => $owner->id]);
        $owner->update(['account_id' => $account->id]);
        $merchant = Merchant::factory()->create(['account_id' => $account->id, 'owner_user_id' => $owner->id]);
        $merchant->users()->attach($owner, ['role' => 'owner']);
        $user = User::factory()->create(['role' => 'driver', 'account_id' => $account->id]);
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id, 'is_active' => true]);
        $run = Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'driver_id' => $driver->id, 'status' => Run::STATUS_IN_PROGRESS, 'started_at' => now(), 'driver_workflow' => true]);

        return [$user, $owner, $merchant, $run];
    }

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('actions-test')->plainTextToken];
    }

    private function location(Merchant $merchant): Location
    {
        return Location::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Depot', 'address_line_1' => '1 Test Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'latitude' => -26, 'longitude' => 28]);
    }

    public function test_delivery_order_persists_scoped_remaining_shipments_and_rejects_stale_changes(): void
    {
        [$driver, , $merchant, $run] = $this->context();
        $links = collect(['booked', 'delivered', 'in_transit'])->map(function ($status, $index) use ($merchant, $run) {
            $shipment = Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'status' => $status, 'merchant_order_ref' => 'ORDER-'.$index]);

            return RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'sequence' => $index + 1, 'status' => $status === 'delivered' ? 'done' : 'active']);
        });
        $headers = $this->auth($driver);
        $url = "/api/v1/driver/runs/{$run->uuid}/delivery-order";
        $before = [$links[0]->shipment->uuid, $links[2]->shipment->uuid];
        $after = array_reverse($before);
        $this->getJson($url, $headers)->assertOk()->assertJsonCount(2, 'data.shipments')->assertJsonPath('data.shipments.0.shipment_id', $before[0]);
        $data = ['shipment_ids' => $after, 'expected_shipment_ids' => $before];
        $this->patchJson($url, $data, $headers)->assertOk()->assertJsonPath('data.shipment_ids', $after);
        $this->patchJson($url, $data, $headers)->assertOk();
        $this->assertSame(3, $links[0]->fresh()->sequence);
        $this->assertSame(2, $links[1]->fresh()->sequence);
        $this->assertSame('delivered', $links[1]->shipment->fresh()->status);
        $this->assertSame('done', $links[1]->fresh()->status);
        $this->assertSame(1, $links[2]->fresh()->sequence);
        $this->getJson('/api/v1/driver/dashboard', $headers)->assertOk()->assertJsonPath('data.run_shipments.0.shipment_id', $after[0]);
        $this->assertSame(1, ActivityLog::where('action', 'run_delivery_order_updated')->count());
        $this->patchJson($url, ['shipment_ids' => $before, 'expected_shipment_ids' => $before], $headers)->assertConflict();
        $this->patchJson($url, ['shipment_ids' => [$after[0], $after[0]], 'expected_shipment_ids' => $after], $headers)->assertUnprocessable();
        $this->patchJson($url, ['shipment_ids' => [$after[0]], 'expected_shipment_ids' => $after], $headers)->assertConflict();
        $links[0]->shipment->update(['status' => 'delivered']);
        $this->patchJson($url, ['shipment_ids' => $before, 'expected_shipment_ids' => $after], $headers)->assertConflict();
        [$otherDriver] = $this->context();
        $this->getJson($url, $this->auth($otherDriver))->assertNotFound();
        $this->patchJson($url, $data, $this->auth($otherDriver))->assertNotFound();
        $run->update(['status' => 'completed']);
        $this->getJson($url, $headers)->assertConflict();
        $this->patchJson($url, $data, $headers)->assertConflict();
    }

    public function test_requests_preserve_active_run_and_dispatch_approves_empty_run_idempotently(): void
    {
        [$driver, $owner, , $run] = $this->context();
        $headers = $this->auth($driver);
        $url = "/api/v1/driver/runs/{$run->uuid}/end-requests";
        $this->postJson($url, ['reason' => ' '], $headers)->assertUnprocessable();
        $id = $this->postJson($url, ['reason' => ' Shift ended '], $headers)->assertCreated()->assertJsonPath('data.reason', 'Shift ended')->json('data.request_id');
        $this->postJson($url, ['reason' => 'Shift ended'], $headers)->assertOk()->assertJsonPath('data.request_id', $id);
        $this->assertSame('in_progress', $run->fresh()->status);
        $this->assertDatabaseCount('run_end_requests', 1);
        $this->getJson('/api/v1/driver/dashboard', $headers)->assertOk()->assertJsonPath('data.current_run.end_request.status', 'pending');
        $review = "/api/v1/runs/{$run->uuid}/end-requests/$id/review";
        $this->postJson($review, ['decision' => 'approved', 'confirm_early_closure' => true], $headers)->assertForbidden();
        $this->postJson($review, ['decision' => 'approved', 'confirm_early_closure' => false], $this->auth($owner))->assertUnprocessable();
        $this->postJson($review, ['decision' => 'approved', 'confirm_early_closure' => true], $this->auth($owner))->assertOk()->assertJsonPath('data.status', 'approved');
        $completed = $run->fresh()->completed_at;
        $this->postJson($review, ['decision' => 'approved', 'confirm_early_closure' => true], $this->auth($owner))->assertOk();
        $this->postJson($review, ['decision' => 'rejected', 'reason' => 'Different decision'], $this->auth($owner))->assertConflict();
        $this->assertEquals($completed, $run->fresh()->completed_at);
        $this->getJson('/api/v1/driver/dashboard', $headers)->assertOk()->assertJsonPath('data.current_run', null);
        $this->assertSame(1, ActivityLog::where('action', 'run_end_approved')->count());
    }

    public function test_rejection_requires_reason_and_allows_resubmission(): void
    {
        [$driver, $owner, , $run] = $this->context();
        $id = $this->postJson("/api/v1/driver/runs/{$run->uuid}/end-requests", ['reason' => 'Truck issue'], $this->auth($driver))->assertCreated()->json('data.request_id');
        $url = "/api/v1/runs/{$run->uuid}/end-requests/$id/review";
        $this->postJson($url, ['decision' => 'rejected'], $this->auth($owner))->assertUnprocessable();
        $this->postJson($url, ['decision' => 'rejected', 'reason' => 'Contact dispatch'], $this->auth($owner))->assertOk();
        $this->postJson("/api/v1/driver/runs/{$run->uuid}/end-requests", ['reason' => 'Truck still broken'], $this->auth($driver))->assertCreated();
        $this->assertDatabaseCount('run_end_requests', 2);
        $this->assertSame('in_progress', $run->fresh()->status);
    }

    public function test_early_approval_preserves_unfinished_shipments_and_assignments(): void
    {
        [$driver, $owner, $merchant, $run] = $this->context();
        $shipment = Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'status' => 'booked', 'merchant_order_ref' => 'UNFINISHED']);
        $assignment = RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'status' => RunShipment::STATUS_PLANNED, 'sequence' => 1]);
        $before = $assignment->fresh()->getAttributes();
        $id = $this->postJson("/api/v1/driver/runs/{$run->uuid}/end-requests", ['reason' => 'Breakdown'], $this->auth($driver))->assertCreated()->json('data.request_id');
        $this->postJson("/api/v1/runs/{$run->uuid}/end-requests/$id/review", ['decision' => 'approved', 'confirm_early_closure' => true], $this->auth($owner))->assertOk();
        $this->assertSame('booked', $shipment->fresh()->status);
        $this->assertEquals($before, $assignment->fresh()->getAttributes());
    }

    public function test_end_request_posts_one_scoped_driver_message_and_admin_unread_reference(): void
    {
        [$driver, $owner, $merchant, $run] = $this->context();
        $url = "/api/v1/driver/runs/{$run->uuid}/end-requests";
        $headers = $this->auth($driver);
        $this->postJson($url, ['reason' => ' '], $headers)->assertUnprocessable();
        $this->assertDatabaseCount('messages', 0);
        $id = $this->postJson($url, ['reason' => ' Truck breakdown '], $headers)->assertCreated()->json('data.request_id');
        $this->postJson($url, ['reason' => 'Truck breakdown'], $headers)->assertOk();
        $chat = Conversation::sole();
        $message = $chat->messages()->sole();
        $this->assertSame($driver->id, $message->user_id);
        $this->assertSame($merchant->account_id, $message->account_id);
        $this->assertSame($merchant->id, $message->merchant_id);
        $this->assertStringContainsString('Reason: Truck breakdown', $message->body);
        $this->assertSame('run-end-request:'.$id, $message->temporary_id);
        $this->assertNull($message->read_at);
        $this->assertSame($run->uuid, $message->attachments()->sole()->meta['reference']['id']);
        $this->getJson("/api/v1/conversations/{$chat->uuid}/messages", $headers)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('data.0.attachments.0.reference.type', 'run');
        $this->getJson("/api/v1/conversations/{$chat->uuid}/messages", $this->auth($owner))->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/v1/conversations/unread?merchant_id='.$merchant->uuid, $this->auth($owner))
            ->assertOk()->assertJsonPath('data.unread_count', 1);
        [$foreign] = $this->context();
        $this->getJson("/api/v1/conversations/{$chat->uuid}/messages", $this->auth($foreign))->assertForbidden();
        $this->assertSame('in_progress', $run->fresh()->status);
    }

    public function test_end_request_event_reaches_closed_chat_and_resubmission_gets_a_new_message(): void
    {
        [$driver, $owner, $merchant, $run] = $this->context();
        $chat = app(ConversationService::class)->driverChat($driver, $merchant, null);
        $chat->update(['status' => 'closed']);
        $url = "/api/v1/driver/runs/{$run->uuid}/end-requests";
        $id = $this->postJson($url, ['reason' => 'Breakdown'], $this->auth($driver))->assertCreated()->json('data.request_id');
        $this->assertSame('closed', $chat->fresh()->status);
        $this->postJson("/api/v1/runs/{$run->uuid}/end-requests/$id/review", ['decision' => 'rejected', 'reason' => 'Try again'], $this->auth($owner))->assertOk();
        $this->postJson($url, ['reason' => 'Still broken'], $this->auth($driver))->assertCreated();
        $this->assertSame(2, $chat->messages()->count());
        $this->assertStringContainsString('Still broken', $chat->latestMessage->body);
    }

    public function test_end_request_and_audit_roll_back_when_conversation_delivery_fails(): void
    {
        [$driver, , $merchant, $run] = $this->context();
        $chat = app(ConversationService::class)->driverChat($driver, $merchant, null);
        $chat->delete();
        $this->postJson("/api/v1/driver/runs/{$run->uuid}/end-requests", ['reason' => 'Breakdown'], $this->auth($driver))->assertStatus(410);
        $this->assertDatabaseCount('run_end_requests', 0);
        $this->assertDatabaseCount('messages', 0);
        $this->assertSame(0, ActivityLog::where('action', 'run_end_requested')->count());
        $this->assertSame('in_progress', $run->fresh()->status);
    }

    public function test_manual_costs_are_zar_exact_deduplicated_and_scoped(): void
    {
        [$driver, , $merchant, $run] = $this->context();
        $merchant->update(['currency' => 'USD']);
        $url = "/api/v1/driver/runs/{$run->uuid}/additional-costs";
        $headers = $this->auth($driver);
        $data = ['title' => ' Parking ', 'amount' => '10.10', 'client_request_id' => (string) Str::uuid()];
        $this->postJson($url, $data, $headers)->assertCreated()->assertJsonPath('data.currency', 'ZAR')->assertJsonPath('data.source', 'manual')->assertJsonPath('data.amount', '10.10');
        $this->postJson($url, $data, $headers)->assertOk();
        $this->assertDatabaseCount('run_costs', 1);
        $this->postJson($url, array_merge($data, ['amount' => '12.00']), $headers)->assertConflict();
        foreach (['0', '-1', '1.001', '1e2', '1,20', ''] as $amount) {
            $this->postJson($url, array_merge($data, ['amount' => $amount, 'client_request_id' => (string) Str::uuid()]), $headers)->assertUnprocessable();
        }
        $this->assertDatabaseHas('run_costs', ['amount' => '10.10', 'title' => 'Parking', 'created_by' => $driver->id]);
        $run->update(['status' => 'completed']);
        $this->postJson($url, $data, $headers)->assertOk();
        $this->postJson($url, array_merge($data, ['client_request_id' => (string) Str::uuid()]), $headers)->assertConflict();
    }

    public function test_endpoint_edits_preserve_history_round_trip_and_reject_stale_and_invalid_locations(): void
    {
        [$driver, , $merchant, $run] = $this->context();
        $location = $this->location($merchant);
        $headers = $this->auth($driver);
        $url = "/api/v1/driver/runs/{$run->uuid}/endpoints";
        $data = ['origin_location_id' => $location->uuid, 'destination_location_id' => $location->uuid, 'expected_origin_location_id' => null, 'expected_destination_location_id' => null];
        $started = $run->started_at;
        $this->patchJson($url, $data, $headers)->assertOk();
        $this->patchJson($url, $data, $headers)->assertOk();
        $this->assertEquals($started, $run->fresh()->started_at);
        $other = $this->location($merchant);
        $this->patchJson($url, array_merge($data, ['origin_location_id' => $other->uuid]), $headers)->assertConflict();
        $data['expected_origin_location_id'] = $data['expected_destination_location_id'] = $location->uuid;
        $this->patchJson($url, array_merge($data, ['destination_location_id' => (string) Str::uuid()]), $headers)->assertUnprocessable();
        $this->assertSame($location->id, $run->fresh()->destination_location_id);
        $uuid = (string) Str::uuid();
        Cache::put("driver-trip-location:{$driver->driver->id}:$uuid", ['uuid' => $uuid, 'account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Draft', 'address_line_1' => '2 Test Street', 'city' => 'Johannesburg', 'province' => 'Gauteng', 'post_code' => '2000', 'latitude' => -26, 'longitude' => 28]);
        $count = Location::count();
        $this->patchJson($url, array_merge($data, ['origin_location_id' => $uuid, 'destination_location_id' => (string) Str::uuid()]), $headers)->assertUnprocessable();
        $this->assertSame($count, Location::count());
    }

    public function test_other_drivers_and_inactive_drivers_cannot_mutate_runs(): void
    {
        [$driver, , , $run] = $this->context();
        [$other] = $this->context();
        $url = "/api/v1/driver/runs/{$run->uuid}/end-requests";
        $this->postJson($url, ['reason' => 'test'], $this->auth($other))->assertNotFound();
        $driver->driver->update(['is_active' => false]);
        $this->postJson($url, ['reason' => 'test'], $this->auth($driver))->assertForbidden();
    }

    public function test_other_supported_closure_resolves_pending_requests(): void
    {
        [$driver, , , $run] = $this->context();
        $this->postJson("/api/v1/driver/runs/{$run->uuid}/end-requests", ['reason' => 'Done'], $this->auth($driver))->assertCreated();
        $run->update(['status' => 'completed', 'completed_at' => now()]);
        $this->assertSame('resolved', $run->latestEndRequest->status);
    }
}
