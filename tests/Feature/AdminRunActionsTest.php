<?php

namespace Tests\Feature;

use App\Models\{Account, ActivityLog, Driver, Location, Merchant, MerchantEnvironment, Run, RunShipment, Shipment, User};
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AdminRunActionsTest extends TestCase
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
        $run = Run::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'driver_id' => $driver->id, 'status' => 'in_progress']);
        return [$owner, $merchant, $run, $user];
    }

    private function auth(User $user): array
    {
        return ['Authorization' => 'Bearer '.$user->createToken('admin-actions')->plainTextToken];
    }

    private function location(Merchant $merchant, array $extra = []): Location
    {
        return Location::create($extra + ['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Depot', 'address_line_1' => '1 Road', 'city' => 'Town', 'province' => 'Gauteng', 'post_code' => '2000', 'country' => 'ZA', 'latitude' => 0, 'longitude' => 0]);
    }

    private function assignment(Merchant $merchant, Run $run, string $status, int $sequence): RunShipment
    {
        $shipment = Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'status' => $status, 'merchant_order_ref' => 'S'.$sequence]);
        return RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'sequence' => $sequence, 'status' => RunShipment::STATUS_PLANNED]);
    }

    public function test_edit_endpoints_across_ready_and_active_states_preserves_history_and_supports_round_trips(): void
    {
        [$owner, $merchant, $run] = $this->context();
        $headers = $this->auth($owner);
        $location = $this->location($merchant);
        $url = "/api/v1/runs/{$run->uuid}/endpoints";
        foreach (['draft', 'dispatched', 'in_progress'] as $status) {
            $started = now()->subHour();
            $run->refresh()->update(['status' => $status, 'started_at' => $started, 'origin_location_id' => null, 'destination_location_id' => null]);
            $payload = ['origin_location_id' => $location->uuid, 'destination_location_id' => $location->uuid, 'expected_origin_location_id' => null, 'expected_destination_location_id' => null];
            $this->patchJson($url, $payload, $headers)->assertOk()->assertJsonPath('data.origin_location_id', $location->uuid);
            $this->patchJson($url, $payload, $headers)->assertOk();
            $this->assertEquals($started->toDateTimeString(), $run->fresh()->started_at->toDateTimeString());
            $this->assertSame($status, $run->fresh()->status);
            $this->getJson("/api/v1/runs/{$run->uuid}", $headers)->assertOk()
                ->assertJsonPath('data.planned_origin.location_id', $location->uuid)
                ->assertJsonPath('data.planned_destination.location_id', $location->uuid)
                ->assertJsonPath('data.can_edit_endpoints', true)->assertJsonPath('data.can_update_delivery_order', true);
        }
        $this->assertSame(3, ActivityLog::where('action', 'run_endpoints_updated')->count());
    }

    public function test_endpoint_conflicts_invalid_locations_and_atomicity(): void
    {
        [$owner, $merchant, $run] = $this->context();
        $a = $this->location($merchant); $b = $this->location($merchant);
        $run->update(['origin_location_id' => $a->id]);
        $payload = ['origin_location_id' => $b->uuid, 'destination_location_id' => $b->uuid, 'expected_origin_location_id' => null, 'expected_destination_location_id' => null];
        $url = "/api/v1/runs/{$run->uuid}/endpoints"; $headers = $this->auth($owner);
        $this->patchJson($url, $payload, $headers)->assertConflict();
        $payload['expected_origin_location_id'] = $a->uuid;
        $foreign = $this->context()[1]; $other = $this->location($foreign);
        $payload['destination_location_id'] = $other->uuid;
        $this->patchJson($url, $payload, $headers)->assertUnprocessable();
        $this->assertSame($a->id, $run->fresh()->origin_location_id);
        $environment = MerchantEnvironment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'name' => 'Other', 'color' => '#123456', 'url' => 'https://example.test', 'token_hash' => hash('sha256', 'other')]);
        $invalid = $this->location($merchant, ['environment_id' => $environment->id]);
        $payload['destination_location_id'] = $invalid->uuid;
        $this->patchJson($url, $payload, $headers)->assertUnprocessable();
        $invalid->update(['environment_id' => null, 'latitude' => 91]);
        $this->patchJson($url, $payload, $headers)->assertUnprocessable();
        $this->patchJson($url, ['origin_location_id' => $a->uuid], $headers)->assertUnprocessable();
        $this->assertSame(0, ActivityLog::where('action', 'run_endpoints_updated')->count());
    }

    public function test_ordering_preserves_terminal_entries_and_rejects_stale_membership_and_duplicates(): void
    {
        [$owner, $merchant, $run] = $this->context();
        $a = $this->assignment($merchant, $run, 'booked', 1);
        $terminal = $this->assignment($merchant, $run, 'delivered', 2);
        $b = $this->assignment($merchant, $run, 'in_transit', 3);
        $aId = $a->shipment->uuid; $bId = $b->shipment->uuid;
        $url = "/api/v1/runs/{$run->uuid}/delivery-order"; $headers = $this->auth($owner);
        foreach (['draft', 'dispatched', 'in_progress'] as $state) {
            $run->update(['status' => $state]);
            $a->refresh()->update(['sequence' => 1]); $b->refresh()->update(['sequence' => 3]);
            $this->getJson($url, $headers)->assertOk()->assertJsonCount(2, 'data.shipments')->assertJsonPath('data.shipments.0.shipment_id', $aId);
            $payload = ['shipment_ids' => [$bId, $aId], 'expected_shipment_ids' => [$aId, $bId]];
            $this->patchJson($url, $payload, $headers)->assertOk();
            $this->patchJson($url, $payload, $headers)->assertOk();
            $this->assertSame(2, $terminal->fresh()->sequence);
            $this->assertSame('delivered', $terminal->shipment->fresh()->status);
            $this->assertSame(1, $b->fresh()->sequence);
        }
        $this->assertSame(3, ActivityLog::where('action', 'run_delivery_order_updated')->count());
        $this->patchJson($url, ['shipment_ids' => [$aId, $bId], 'expected_shipment_ids' => [$aId, $bId]], $headers)->assertConflict();
        $this->patchJson($url, ['shipment_ids' => [$aId, $aId], 'expected_shipment_ids' => [$bId, $aId]], $headers)->assertUnprocessable();
        $this->assignment($merchant, $run, 'booked', 4);
        $this->patchJson($url, ['shipment_ids' => [$aId, $bId], 'expected_shipment_ids' => [$bId, $aId]], $headers)->assertConflict();
    }

    public function test_permission_and_closed_state_guards(): void
    {
        [$owner, $merchant, $run, $driver] = $this->context();
        $location = $this->location($merchant);
        $payload = ['origin_location_id' => $location->uuid, 'destination_location_id' => $location->uuid, 'expected_origin_location_id' => null, 'expected_destination_location_id' => null];
        $viewer = User::factory()->create(['role' => 'user', 'account_id' => $merchant->account_id]);
        $merchant->users()->attach($viewer, ['role' => 'read_only']);
        foreach ([$viewer, $driver] as $user) {
            $headers = $this->auth($user);
            $this->getJson("/api/v1/runs/{$run->uuid}/delivery-order", $headers)->assertForbidden();
            $this->patchJson("/api/v1/runs/{$run->uuid}/endpoints", $payload, $headers)->assertForbidden();
        }
        $other = $this->context()[0];
        $this->getJson("/api/v1/runs/{$run->uuid}/delivery-order", $this->auth($other))->assertNotFound();
        foreach (['completed', 'cancelled'] as $state) {
            $run->update(['status' => $state]); $headers = $this->auth($owner);
            $this->patchJson("/api/v1/runs/{$run->uuid}/endpoints", $payload, $headers)->assertConflict();
            $this->getJson("/api/v1/runs/{$run->uuid}/delivery-order", $headers)->assertConflict();
            $this->getJson("/api/v1/runs/{$run->uuid}", $headers)->assertOk()->assertJsonPath('data.can_edit_endpoints', false)->assertJsonPath('data.can_update_delivery_order', false)->assertJsonPath('data.can_message_driver', true);
        }
    }

    public function test_staff_can_attach_only_runs_for_the_selected_driver_chat(): void
    {
        [$owner, $merchant, $run] = $this->context();
        $headers = $this->auth($owner);
        $chatId = $this->postJson('/api/v1/conversations/driver', ['merchant_id' => $merchant->uuid, 'driver_id' => $run->driver->uuid], $headers)
            ->assertOk()->json('data.conversation_id');
        $base = "/api/v1/conversations/$chatId";
        $this->assertDatabaseCount('messages', 0);
        foreach (['draft', 'in_progress', 'completed', 'cancelled'] as $status) {
            $run->update(['status' => $status]);
            $payload = ['temporary_id' => 'staff-'.$status, 'body' => 'Please review', 'references' => [['type' => 'run', 'id' => $run->uuid]]];
            $this->postJson($base.'/messages', $payload, $headers)->assertCreated()->assertJsonPath('data.attachments.0.reference.id', $run->uuid);
            $this->postJson($base.'/messages', $payload, $headers)->assertOk();
        }
        $this->assertDatabaseCount('messages', 4);
        $foreign = $this->context()[2];
        $this->postJson($base.'/messages', ['temporary_id' => 'foreign', 'references' => [['type' => 'run', 'id' => $foreign->uuid]]], $headers)->assertNotFound();
        $sameMerchantOtherDriver = Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'status' => 'draft']);
        $this->postJson($base.'/messages', ['temporary_id' => 'unassigned', 'references' => [['type' => 'run', 'id' => $sameMerchantOtherDriver->uuid]]], $headers)->assertNotFound();
        $chat = \App\Models\Conversation::where('uuid', $chatId)->firstOrFail();
        $chat->update(['status' => 'closed']);
        $this->postJson($base.'/messages', ['temporary_id' => 'closed', 'references' => [['type' => 'run', 'id' => $run->uuid]]], $headers)->assertConflict();
        $this->assertDatabaseCount('messages', 4);
    }

    public function test_super_admin_audit_uses_run_account_and_actual_actor(): void
    {
        [, $merchant, $run] = $this->context();
        $admin = $this->context()[0];
        $admin->update(['role' => 'super_admin']);
        $location = $this->location($merchant);
        $this->patchJson("/api/v1/runs/{$run->uuid}/endpoints", ['origin_location_id' => $location->uuid, 'destination_location_id' => $location->uuid, 'expected_origin_location_id' => null, 'expected_destination_location_id' => null], $this->auth($admin))->assertOk();
        $audit = ActivityLog::where('action', 'run_endpoints_updated')->firstOrFail();
        $this->assertSame($merchant->account_id, $audit->account_id);
        $this->assertSame($merchant->id, $audit->merchant_id);
        $this->assertSame($admin->id, $audit->actor_user_id);
    }

    public function test_planned_endpoints_do_not_use_shipment_display_fallbacks(): void
    {
        [$owner, $merchant, $run] = $this->context();
        $location = $this->location($merchant);
        $assignment = $this->assignment($merchant, $run, 'booked', 1);
        $assignment->shipment->update(['pickup_location_id' => $location->id, 'dropoff_location_id' => $location->id]);
        $this->getJson("/api/v1/runs/{$run->uuid}", $this->auth($owner))->assertOk()
            ->assertJsonPath('data.origin.location_id', $location->uuid)->assertJsonPath('data.planned_origin', null)->assertJsonPath('data.planned_destination', null);
    }
}
