<?php

namespace Tests\Feature;

use App\Jobs\CheckMessagePushReceipts;
use App\Jobs\SendDriverMessagePush;
use App\Models\Account;
use App\Models\Conversation;
use App\Models\Driver;
use App\Models\Merchant;
use App\Models\Message;
use App\Models\User;
use App\Models\UserDevice;
use App\Services\AuthService;
use App\Services\ConversationService;
use App\Services\UserDeviceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ConversationApiTest extends TestCase
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
        $driver = Driver::create(['account_id' => $account->id, 'merchant_id' => $merchant->id, 'user_id' => $user->id]);

        return [$owner, $merchant, $user, $driver];
    }

    private function headers(User $user): array
    {
        return ['Accept' => 'application/json', 'Authorization' => 'Bearer '.$user->createToken('chat-test')->plainTextToken];
    }

    private function chat(User $driver): string
    {
        return $this->postJson('/api/v1/conversations/driver', [], $this->headers($driver))->assertOk()->assertJsonPath('data.status', 'active')->assertJsonPath('data.is_private', true)->json('data.conversation_id');
    }

    public function test_reference_pickers_default_to_ten_recent_records_and_search_older_assignments(): void
    {
        [$owner, $merchant, $user, $driver] = $this->context();
        $driver->update(['is_active' => true]);
        $runs = [];
        $shipments = [];
        $now = now();
        for ($i = 0; $i < 12; $i++) {
            // Higher IDs are deliberately older; timestamps determine recency.
            $created = $now->copy()->subMinutes(max(0, $i - 1));
            $runs[] = $run = \App\Models\Run::create(['account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id, 'driver_id' => $driver->id,
                'status' => 'completed', 'created_at' => $created]);
            $shipments[] = $shipment = \App\Models\Shipment::create(['account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id, 'status' => 'delivered',
                'merchant_order_ref' => 'RECENT-'.$i, 'created_at' => $created]);
            \App\Models\RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id,
                'sequence' => 1, 'status' => 'done']);
            $run->forceFill(['created_at' => $created])->save();
            $shipment->forceFill(['created_at' => $created])->save();
        }
        \App\Models\Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'driver_id' => null, 'status' => 'dispatched']);
        \App\Models\Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'status' => 'booked', 'merchant_order_ref' => 'UNASSIGNED']);
        $base = '/api/v1/conversations/'.$this->chat($user).'/references';
        $headers = $this->headers($user);
        foreach (['run' => $runs, 'shipment' => $shipments] as $type => $records) {
            $expected = array_map(fn ($i) => $records[$i]->uuid, [1, 0, 2, 3, 4, 5, 6, 7, 8, 9]);
            foreach (['', '&search=', '&search=%20%20&page=2'] as $query) {
                $response = $this->getJson($base.'?type='.$type.$query, $headers)
                    ->assertOk()->assertJsonCount(10, 'data')
                    ->assertJsonPath('meta.current_page', 1)->assertJsonPath('meta.last_page', 1);
                $this->assertSame($expected, array_column($response->json('data'), 'id'));
            }
            $this->getJson($base.'?type='.$type.'&search='.$records[11]->uuid, $headers)
                ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $records[11]->uuid);
        }
        $this->getJson($base.'?type=shipment&search=RECENT', $headers)->assertOk()->assertJsonCount(12, 'data');
        $this->getJson($base.'?type=run', $this->headers($owner))->assertForbidden();
    }

    public function test_driver_can_search_and_send_scoped_run_and_shipment_references(): void
    {
        [$owner, $merchant, $user, $driver] = $this->context();
        $driver->update(['is_active' => true]);
        $run = \App\Models\Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'driver_id' => $driver->id, 'status' => 'completed']);
        $shipment = \App\Models\Shipment::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'status' => 'delivered', 'merchant_order_ref' => 'CHAT-REF']);
        $assignment = \App\Models\RunShipment::create(['run_id' => $run->id, 'shipment_id' => $shipment->id, 'sequence' => 1, 'status' => 'done']);
        $foreign = \App\Models\Run::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'driver_id' => null, 'status' => 'dispatched']);
        $chat = $this->chat($user);
        $headers = $this->headers($user);
        $base = '/api/v1/conversations/'.$chat;
        $this->getJson($base.'/references?type=run&search=Run%20'.$run->id, $headers)
            ->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $run->uuid);
        $this->getJson($base.'/references?type=shipment&search=CHAT', $headers)
            ->assertOk()->assertJsonPath('data.0.id', $shipment->uuid);
        $this->getJson($base.'/references?type=run&search='.$foreign->uuid, $headers)->assertOk()->assertJsonCount(0, 'data');
        $payload = ['temporary_id' => 'reference-draft', 'references' => [
            ['type' => 'run', 'id' => $run->uuid], ['type' => 'shipment', 'id' => $shipment->uuid],
        ]];
        $result = $this->postJson($base.'/messages', $payload, $headers)->assertCreated()
            ->assertJsonCount(2, 'data.attachments')->assertJsonPath('data.attachments.0.reference.id', $run->uuid)
            ->assertJsonPath('data.attachments.1.reference.label', 'CHAT-REF')->assertJsonPath('data.attachments.1.reference.run_id', $run->uuid);
        $this->postJson($base.'/messages', $payload, $headers)->assertOk()->assertJsonPath('data.message_id', $result->json('data.message_id'));
        $this->getJson($base.'/messages', $this->headers($owner))->assertOk()->assertJsonPath('data.0.attachments.1.reference.id', $shipment->uuid);
        $this->getJson($base.'/attachments/'.$result->json('data.attachments.0.attachment_id').'/download', $headers)->assertStatus(422);
        $this->postJson($base.'/messages', ['temporary_id' => 'foreign', 'references' => [['type' => 'run', 'id' => $foreign->uuid]]], $headers)->assertNotFound();
        $assignment->update(['status' => 'removed']);
        $this->getJson($base.'/references?type=shipment&search=CHAT', $headers)->assertOk()->assertJsonCount(0, 'data');
        $this->postJson($base.'/messages', ['temporary_id' => 'removed', 'references' => [['type' => 'shipment', 'id' => $shipment->uuid]]], $headers)->assertNotFound();
        $this->postJson($base.'/messages', ['temporary_id' => 'too-many', 'references' => array_fill(0, 6, ['type' => 'run', 'id' => $run->uuid])], $headers)->assertUnprocessable();
        $this->postJson($base.'/messages', ['temporary_id' => 'bad-type', 'references' => [['type' => 'location', 'id' => $run->uuid]]], $headers)->assertUnprocessable();
        $this->post($base.'/messages', ['temporary_id' => 'mixed-limit',
            'references' => array_fill(0, 5, ['type' => 'run', 'id' => $run->uuid]),
            'attachments' => [UploadedFile::fake()->create('note.pdf', 1)]], $headers)->assertUnprocessable();
        $this->getJson($base.'/references?type=run&search='.$run->uuid, $this->headers($owner))->assertForbidden();
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseCount('message_attachments', 2);
    }

    public function test_inbox_searches_titles_descriptions_active_members_and_driver_names_before_pagination(): void
    {
        [$owner, $merchant, $driverUser, $profile] = $this->context();
        $service = app(ConversationService::class);
        $driver = $service->driverChat($owner, $merchant, $profile->uuid);
        $driverUser->update(['name' => 'Renamed Road Driver']);
        $member = User::factory()->create(['account_id' => $merchant->account_id, 'name' => 'Warehouse Participant']);
        $make = function ($title, $description = null) use ($owner, $merchant, $service) {
            $chat = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'type' => 'normal', 'title' => $title, 'description' => $description]);
            $service->addMember($chat, $owner, 'owner');

            return $chat;
        };
        $title = $make('Dispatch coordination');
        $description = $make('Operations', 'Dispatch paperwork');
        $participant = $make('Team');
        $service->addMember($participant, $member);
        $removed = $make('Former team');
        $service->addMember($removed, $member)->update(['state' => 'removed']);
        $headers = $this->headers($owner);
        $url = '/api/v1/conversations?merchant_id='.$merchant->uuid;
        $this->getJson($url.'&search=Dispatch&per_page=1', $headers)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2);
        $first = $this->getJson($url.'&search=Dispatch&per_page=1', $headers)->json('data.0.conversation_id');
        $second = $this->getJson($url.'&search=Dispatch&per_page=1&page=2', $headers)->assertOk()->json('data.0.conversation_id');
        $this->assertEqualsCanonicalizing([$title->uuid, $description->uuid], [$first, $second]);
        $this->getJson($url.'&search=Warehouse', $headers)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.conversation_id', $participant->uuid);
        $this->getJson($url.'&search=Renamed', $headers)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.conversation_id', $driver->uuid);
        $this->getJson($url.'&type=driver&search=Renamed', $headers)->assertOk()->assertJsonCount(1, 'data');
        $this->getJson($url.'&type=normal&search=Renamed', $headers)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url.'&type=normal', $headers)->assertOk()->assertJsonCount(4, 'data');
        $this->getJson($url.'&search=%20%20', $headers)->assertOk()->assertJsonCount(5, 'data');
        $this->getJson($url.'&search=NoMatchingConversation', $headers)->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_inbox_search_cannot_expand_conversation_or_merchant_visibility(): void
    {
        [$owner, $merchant, $driverUser, $profile] = $this->context();
        $service = app(ConversationService::class);
        $chat = $service->driverChat($owner, $merchant, $profile->uuid);
        $chat->update(['title' => 'Shared needle']);
        $driverUser->update(['name' => 'Needle driver']);
        $outsider = User::factory()->create(['account_id' => $merchant->account_id, 'name' => 'Needle outsider']);
        $hidden = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'type' => 'normal', 'title' => 'Needle hidden', 'description' => 'Needle description']);
        $service->addMember($hidden, $outsider, 'owner');
        $otherMerchant = Merchant::factory()->create(['account_id' => $merchant->account_id, 'owner_user_id' => $owner->id]);
        $foreign = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $otherMerchant->id,
            'type' => 'normal', 'title' => 'Needle foreign']);
        $service->addMember($foreign, $owner, 'owner');
        [$foreignOwner, $foreignMerchant, , $foreignDriver] = $this->context();
        $service->driverChat($foreignOwner, $foreignMerchant, $foreignDriver->uuid)->update(['title' => 'Needle another account']);
        $url = '/api/v1/conversations?merchant_id='.$merchant->uuid.'&search=Needle';
        $this->getJson($url, $this->headers($owner))->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.conversation_id', $chat->uuid);
        $viewer = User::factory()->create(['account_id' => $merchant->account_id, 'role' => 'user']);
        $merchant->users()->attach($viewer, ['role' => 'read_only']);
        $this->getJson($url, $this->headers($viewer))->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url.'&type=driver', $this->headers($viewer))->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url, $this->headers($foreignOwner))->assertForbidden();
        $this->getJson($url, $this->headers($driverUser))->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_inbox_can_exclude_empty_conversations_before_pagination(): void
    {
        [$owner, $merchant, , $profile] = $this->context();
        $service = app(ConversationService::class);
        $empty = $service->driverChat($owner, $merchant, $profile->uuid);
        $make = function ($title, $member) use ($merchant, $service) {
            $chat = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'type' => 'normal', 'title' => $title]);
            $service->addMember($chat, $member, 'owner');

            return $chat;
        };
        $withMessage = $make('Dispatch with messages', $owner);
        $withAttachment = $make('Dispatch attachment', $owner);
        $deletedOnly = $make('Dispatch deleted', $owner);
        $outsider = User::factory()->create(['account_id' => $merchant->account_id]);
        $hidden = $make('Dispatch hidden', $outsider);
        foreach ([$withMessage, $withAttachment, $deletedOnly, $hidden] as $chat) {
            $message = $chat->messages()->create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'user_id' => $owner->id, 'body' => $chat->is($withAttachment) ? null : 'Hello']);
            if ($chat->is($deletedOnly)) {
                $message->delete();
            }
        }
        $url = '/api/v1/conversations?merchant_id='.$merchant->uuid;
        $headers = $this->headers($owner);
        $this->getJson($url, $headers)->assertOk()->assertJsonPath('meta.total', 4);
        $first = $this->getJson($url.'&has_messages=1&per_page=1', $headers)->assertOk()
            ->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2)
            ->json('data.0.conversation_id');
        $second = $this->getJson($url.'&has_messages=1&per_page=1&page=2', $headers)->assertOk()->json('data.0.conversation_id');
        $this->assertEqualsCanonicalizing([$withMessage->uuid, $withAttachment->uuid], [$first, $second]);
        $this->getJson($url.'&has_messages=1&type=driver', $headers)->assertOk()->assertJsonCount(0, 'data');
        $this->getJson($url.'&has_messages=1&type=normal&search=Dispatch', $headers)->assertOk()->assertJsonPath('meta.total', 2);
        $this->getJson($url.'&has_messages=0', $headers)->assertOk()->assertJsonPath('meta.total', 4);
        $this->getJson($url.'&has_messages=invalid', $headers)->assertUnprocessable();
        // Creation still returns an empty thread, ready for its first message.
        $this->postJson('/api/v1/conversations/driver', ['merchant_id' => $merchant->uuid, 'driver_id' => $profile->uuid], $headers)
            ->assertOk()->assertJsonPath('data.conversation_id', $empty->uuid)->assertJsonPath('data.latest_message', null);
    }

    public function test_inbox_filter_validation_and_legacy_requests(): void
    {
        [$owner, $merchant, , $profile] = $this->context();
        app(ConversationService::class)->driverChat($owner, $merchant, $profile->uuid);
        $url = '/api/v1/conversations?merchant_id='.$merchant->uuid;
        $headers = $this->headers($owner);
        $this->getJson($url, $headers)->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('meta.total', 1);
        foreach (['&type=group', '&type[]=driver', '&search[]=bad', '&search='.str_repeat('x', 256)] as $invalid) {
            $this->getJson($url.$invalid, $headers)->assertUnprocessable();
        }
        $this->getJson($url.'&type=driver&search=', $headers)->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_dispatch_unread_count_respects_read_rules_membership_and_merchant_scope(): void
    {
        Queue::fake();
        [$owner, $merchant, $driver] = $this->context();
        $headers = $this->headers($owner);
        $endpoint = '/api/v1/conversations/unread?merchant_id='.$merchant->uuid;
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->assertDatabaseCount('conversations', 0);
        $chat = $this->chat($driver);
        $url = "/api/v1/conversations/$chat";
        $incoming = $this->postJson("$url/messages", ['body' => 'Incoming', 'temporary_id' => 'in'], $this->headers($driver))->assertCreated()->json('data.message_id');
        $this->postJson("$url/messages", ['body' => 'Outgoing', 'temporary_id' => 'out'], $headers)->assertCreated();
        $deleted = $this->postJson("$url/messages", ['body' => 'Deleted', 'temporary_id' => 'deleted'], $this->headers($driver))->assertCreated()->json('data.message_id');
        Message::where('uuid', $deleted)->firstOrFail()->delete();
        $member = User::factory()->create(['account_id' => $merchant->account_id, 'role' => 'user']);
        $merchant->users()->attach($member, ['role' => 'read_only']);
        $normal = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'type' => 'normal', 'title' => 'Team']);
        $service = app(ConversationService::class);
        $service->addMember($normal, $owner, 'owner');
        $membership = $service->addMember($normal, $member);
        $normalMessage = Message::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'conversation_id' => $normal->id, 'user_id' => $member->id, 'body' => 'Team incoming']);
        Message::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
            'conversation_id' => $normal->id, 'user_id' => $owner->id, 'body' => 'Team outgoing']);
        [, $foreignMerchant, $foreignDriver] = $this->context();
        $foreignChat = $this->chat($foreignDriver);
        $this->postJson("/api/v1/conversations/$foreignChat/messages", ['body' => 'Foreign', 'temporary_id' => 'foreign'], $this->headers($foreignDriver))->assertCreated();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 2);
        $this->getJson($endpoint, $this->headers($member))->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->postJson("$url/read", ['message_id' => $incoming], $headers)->assertOk();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->postJson("/api/v1/conversations/{$normal->uuid}/read", ['message_id' => $normalMessage->uuid], $headers)->assertOk();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
        // Another member's read cursor remains independent of the owner's.
        $this->getJson($endpoint, $this->headers($member))->assertOk()->assertJsonPath('data.unread_count', 1);
        $membership->update(['state' => 'removed']);
        $this->getJson($endpoint, $this->headers($member))->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->getJson('/api/v1/conversations/unread?merchant_id='.$foreignMerchant->uuid, $headers)->assertForbidden();
        $this->getJson($endpoint, $this->headers($driver))->assertForbidden();
        $this->getJson('/api/v1/conversations/unread', $headers)->assertUnprocessable();
        $normal->delete();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
    }

    public function test_driver_unread_badge_counts_only_received_live_messages_and_clears_on_read(): void
    {
        Queue::fake();
        [$owner, $merchant, $driver] = $this->context();
        $headers = $this->headers($driver);
        $endpoint = '/api/v1/conversations/driver/unread';
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->assertDatabaseCount('conversations', 0);
        $id = $this->chat($driver);
        $url = "/api/v1/conversations/$id/messages";
        $this->postJson($url, ['body' => 'Outgoing', 'temporary_id' => 'out'], $headers)->assertCreated();
        $incoming = $this->postJson($url, ['body' => 'Incoming', 'temporary_id' => 'in'], $this->headers($owner))->assertCreated()->json('data.message_id');
        $deleted = $this->postJson($url, ['body' => 'Deleted', 'temporary_id' => 'deleted'], $this->headers($owner))->assertCreated()->json('data.message_id');
        Message::where('uuid', $deleted)->firstOrFail()->delete();
        [$otherOwner, $otherMerchant, $otherDriver] = $this->context();
        $otherId = $this->chat($otherDriver);
        $this->postJson("/api/v1/conversations/$otherId/messages", ['body' => 'Other account', 'temporary_id' => 'other'], $this->headers($otherOwner))->assertCreated();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 1);
        $this->getJson($endpoint, $this->headers($owner))->assertForbidden();
        $this->postJson("/api/v1/conversations/$id/read", ['message_id' => $incoming], $headers)->assertOk();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
        $this->postJson($url, ['body' => 'New', 'temporary_id' => 'new'], $this->headers($owner))->assertCreated();
        Conversation::where('uuid', $id)->firstOrFail()->delete();
        $this->getJson($endpoint, $headers)->assertOk()->assertJsonPath('data.unread_count', 0);
    }

    public function test_driver_chat_is_unique_and_tenant_scoped_with_server_owned_fields(): void
    {
        Queue::fake();
        [$owner, $merchant, $driver, $profile] = $this->context();
        $id = $this->chat($driver);
        $this->assertSame($id, $this->chat($driver));
        $this->postJson('/api/v1/conversations/driver', ['merchant_id' => $merchant->uuid, 'driver_id' => $profile->uuid], $this->headers($owner))->assertOk()->assertJsonPath('data.conversation_id', $id);
        $url = "/api/v1/conversations/$id/messages";
        $this->postJson($url, ['body' => 'Hello', 'temporary_id' => 'one', 'user_id' => $owner->id, 'account_id' => 999, 'merchant_id' => 999], $this->headers($driver))->assertCreated()->assertJsonPath('data.user_id', $driver->uuid);
        $this->postJson($url, ['body' => 'Hello', 'temporary_id' => 'one'], $this->headers($driver))->assertOk();
        $this->assertDatabaseCount('messages', 1);
        $this->assertDatabaseHas('messages', ['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'user_id' => $driver->id]);
        Queue::assertNothingPushed();
        $other = User::factory()->create(['role' => 'driver', 'account_id' => $merchant->account_id]);
        Driver::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'user_id' => $other->id]);
        $this->getJson($url, $this->headers($other))->assertForbidden();
        [$outsider] = $this->context();
        $this->getJson($url, $this->headers($outsider))->assertForbidden();
        $viewer = User::factory()->create(['role' => 'user', 'account_id' => $merchant->account_id]);
        $merchant->users()->attach($viewer, ['role' => 'read_only']);
        $this->getJson($url, $this->headers($viewer))->assertForbidden();
        $this->getJson('/api/v1/conversations?merchant_id='.$merchant->uuid, $this->headers($viewer))->assertOk()->assertJsonCount(0, 'data');
        $staff = User::factory()->create(['role' => 'user', 'account_id' => $merchant->account_id]);
        $merchant->users()->attach($staff, ['role' => 'developer']);
        $this->getJson($url, $this->headers($staff))->assertOk();
        $this->getJson('/api/v1/conversations/participants?merchant_id='.$merchant->uuid, $this->headers($staff))->assertOk();
    }

    public function test_messages_pagination_reads_and_closed_conversations(): void
    {
        Queue::fake();
        [$owner, , $driver] = $this->context();
        $id = $this->chat($driver);
        $url = "/api/v1/conversations/$id";
        for ($i = 1; $i <= 4; $i++) {
            $this->postJson("$url/messages", ['body' => "Message $i", 'temporary_id' => "id-$i"], $this->headers($owner))->assertCreated();
        }
        $page = $this->getJson("$url/messages?per_page=2", $this->headers($driver))->assertOk()->assertJsonPath('data.0.body', 'Message 3');
        $before = $page->json('meta.next_before');
        $this->getJson("$url/messages?per_page=2&before=$before", $this->headers($driver))->assertOk()->assertJsonPath('data.0.body', 'Message 1')->assertJsonPath('meta.next_before', null);
        $last = $page->json('data.1.message_id');
        $this->postJson("$url/read", ['message_id' => $last], $this->headers($owner))->assertOk();
        $this->assertSame(0, Message::whereNotNull('read_at')->count());
        $this->postJson("$url/read", ['message_id' => $last], $this->headers($driver))->assertOk();
        $this->assertSame(4, Message::whereNotNull('read_at')->count());
        $this->patchJson($url, ['status' => 'closed'], $this->headers($owner))->assertOk();
        $this->postJson("$url/messages", ['body' => 'No', 'temporary_id' => 'closed'], $this->headers($driver))->assertStatus(409);
        $this->postJson("$url/messages", ['body' => 'Retry', 'temporary_id' => 'id-1'], $this->headers($owner))->assertOk();
        $this->getJson("$url/messages", $this->headers($driver))->assertOk();
        $this->patchJson($url, ['status' => 'active'], $this->headers($driver))->assertForbidden();
        Conversation::where('uuid', $id)->first()->delete();
        $this->getJson($url, $this->headers($driver))->assertNotFound();
        $this->postJson('/api/v1/conversations/driver', [], $this->headers($driver))->assertStatus(410);
    }

    public function test_normal_conversation_membership_owner_and_read_cursor(): void
    {
        [$owner, $merchant] = $this->context();
        $member = User::factory()->create(['role' => 'user', 'account_id' => $merchant->account_id]);
        $merchant->users()->attach($member, ['role' => 'admin']);
        $other = User::factory()->create(['role' => 'user', 'account_id' => $merchant->account_id]);
        $merchant->users()->attach($other, ['role' => 'admin']);
        $response = $this->postJson('/api/v1/conversations', ['merchant_id' => $merchant->uuid, 'title' => 'Team', 'member_ids' => [$member->uuid]], $this->headers($owner))->assertCreated();
        $id = $response->json('data.conversation_id');
        $url = "/api/v1/conversations/$id";
        $this->assertDatabaseCount('conversation_members', 2);
        $this->getJson($url, $this->headers($other))->assertForbidden();
        $super = User::factory()->create(['role' => 'super_admin']);
        $this->getJson($url, $this->headers($super))->assertForbidden();
        $message = $this->postJson("$url/messages", ['body' => 'Team message', 'temporary_id' => 'normal'], $this->headers($member))->assertCreated()->json('data.message_id');
        $this->postJson("$url/read", ['message_id' => $message], $this->headers($owner))->assertOk();
        $this->assertNotNull(Conversation::where('uuid', $id)->first()->members()->where('user_id', $owner->id)->first()->last_read_at);
        $this->postJson("$url/members", ['user_id' => $other->uuid], $this->headers($member))->assertForbidden();
        $this->deleteJson("$url/members/{$owner->uuid}", [], $this->headers($owner))->assertUnprocessable();
        $this->deleteJson("$url/members/{$member->uuid}", [], $this->headers($owner))->assertOk();
        $this->postJson("$url/messages", ['body' => 'Removed', 'temporary_id' => 'removed'], $this->headers($member))->assertForbidden();
        $this->postJson("$url/members", ['user_id' => $member->uuid], $this->headers($owner))->assertOk();
        $this->getJson($url, $this->headers($member))->assertOk();
        $this->assertDatabaseCount('conversation_members', 2);
        [$outsider] = $this->context();
        $this->postJson("$url/members", ['user_id' => $outsider->uuid], $this->headers($owner))->assertUnprocessable();
    }

    public function test_private_attachments_validation_and_retry_cleanup(): void
    {
        Storage::fake('local');
        config(['filesystems.default' => 'local']);
        Queue::fake();
        [$owner, , $driver] = $this->context();
        $id = $this->chat($driver);
        $url = "/api/v1/conversations/$id";
        $this->postJson("$url/messages", ['body' => '  ', 'temporary_id' => 'empty'], $this->headers($driver))->assertUnprocessable();
        $this->postJson("$url/messages", ['body' => str_repeat('x', 10001), 'temporary_id' => 'long'], $this->headers($driver))->assertUnprocessable();
        $response = $this->post("$url/messages", ['temporary_id' => 'file', 'attachments' => [UploadedFile::fake()->create('note.pdf', 10, 'application/pdf')]], $this->headers($driver))->assertCreated();
        $attachment = $response->json('data.attachments.0.attachment_id');
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->post("$url/messages", ['temporary_id' => 'file', 'attachments' => [UploadedFile::fake()->create('duplicate.pdf')]], $this->headers($driver))->assertOk();
        $this->assertCount(1, Storage::disk('local')->allFiles());
        $this->getJson("$url/attachments/$attachment/download", $this->headers($owner))->assertOk()->assertJsonStructure(['data' => ['url']]);
        [$outsider] = $this->context();
        $this->getJson("$url/attachments/$attachment/download", $this->headers($outsider))->assertForbidden();
        $this->post("$url/messages", ['temporary_id' => 'large', 'attachments' => [UploadedFile::fake()->create('large.pdf', 20481)]], $this->headers($driver))->assertUnprocessable();
        $this->post("$url/messages", ['temporary_id' => 'six', 'attachments' => array_map(fn ($i) => UploadedFile::fake()->create("$i.pdf"), range(1, 6))], $this->headers($driver))->assertUnprocessable();
    }

    public function test_upload_failure_rolls_back_message_and_cleans_saved_files(): void
    {
        [$owner, , $driver] = $this->context();
        $id = $this->chat($driver);
        $disk = \Mockery::mock(\Illuminate\Contracts\Filesystem\Filesystem::class);
        $disk->shouldReceive('putFileAs')->once()->andReturn('messages/first.pdf');
        $disk->shouldReceive('putFileAs')->once()->andReturn(false);
        $disk->shouldReceive('delete')->once()->with('messages/first.pdf')->andReturn(true);
        Storage::shouldReceive('disk')->with('local')->andReturn($disk);
        config(['filesystems.default' => 'local']);
        $this->post("/api/v1/conversations/$id/messages", ['temporary_id' => 'failure', 'attachments' => [
            UploadedFile::fake()->create('first.pdf'), UploadedFile::fake()->create('second.pdf'),
        ]], $this->headers($driver))->assertStatus(500);
        $this->assertDatabaseCount('messages', 0);
        $this->assertDatabaseCount('message_attachments', 0);
    }

    public function test_unique_constraints_and_migration_rollback(): void
    {
        [, $merchant, $driver] = $this->context();
        $id = $this->chat($driver);
        $conversation = Conversation::where('uuid', $id)->firstOrFail();
        try {
            Conversation::create(['account_id' => $conversation->account_id, 'merchant_id' => $conversation->merchant_id,
                'type' => 'driver', 'type_entry_id' => $conversation->type_entry_id]);
            $this->fail('Duplicate driver conversations must be rejected.');
        } catch (\Illuminate\Database\UniqueConstraintViolationException $error) {
            $this->assertDatabaseCount('conversations', 1);
        }
        $migration = require database_path('migrations/2026_10_07_230000_create_conversation_tables.php');
        $migration->down();
        foreach (['conversations', 'conversation_members', 'messages', 'message_attachments'] as $table) {
            $this->assertFalse(\Illuminate\Support\Facades\Schema::hasTable($table));
        }
        $this->assertDatabaseHas('users', ['id' => $driver->id]);
        $migration->up();
        $tokens = require database_path('migrations/2026_10_07_230100_make_device_push_tokens_unique.php');
        $tokens->down();
        UserDevice::create(['account_id' => $merchant->account_id, 'user_id' => $driver->id, 'platform' => 'android', 'push_token' => 'duplicate']);
        $latest = UserDevice::create(['account_id' => $merchant->account_id, 'user_id' => $driver->id, 'platform' => 'ios', 'push_token' => 'duplicate']);
        $tokens->up();
        $this->assertSame(1, UserDevice::where('push_token', 'duplicate')->count());
        $this->assertSame('duplicate', $latest->fresh()->push_token);
    }

    public function test_push_recipient_receipt_cleanup_and_token_ownership(): void
    {
        Queue::fake();
        [$owner, $merchant, $driver, $profile] = $this->context();
        $conversation = app(ConversationService::class)->driverChat($owner, $merchant, $profile->uuid);
        $message = $conversation->messages()->create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id, 'user_id' => $owner->id, 'body' => 'Private body']);
        $device = app(UserDeviceService::class)->register($driver, ['platform' => 'android', 'push_provider' => 'expo', 'push_token' => 'ExponentPushToken[test]']);
        Http::fake(['*/push/send' => Http::response(['data' => [['status' => 'ok', 'id' => 'receipt-1']]]), '*/push/getReceipts' => Http::response(['data' => ['receipt-1' => ['status' => 'error', 'details' => ['error' => 'DeviceNotRegistered']]]])]);
        (new SendDriverMessagePush($message->id))->handle();
        Http::assertSent(fn ($request) => $request[0]['to'] === $device->push_token && $request[0]['data']['conversation_id'] === $conversation->uuid && $request[0]['data']['kind'] === 'driver_message' && $request[0]['data']['message_id'] === $message->uuid && $request[0]['channelId'] === 'default' && $request[0]['priority'] === 'high' && $request[0]['sound'] === 'default' && $request[0]['body'] !== 'Private body');
        Queue::assertPushed(CheckMessagePushReceipts::class);
        (new CheckMessagePushReceipts(['receipt-1' => $device->push_token]))->handle();
        $this->assertNull($device->fresh()->push_token);
        $other = User::factory()->create(['role' => 'driver', 'account_id' => $merchant->account_id]);
        app(UserDeviceService::class)->register($driver, ['platform' => 'android', 'push_provider' => 'expo', 'push_token' => 'shared']);
        $next = app(UserDeviceService::class)->register($other, ['platform' => 'android', 'push_provider' => 'expo', 'push_token' => 'shared']);
        $this->assertSame(1, UserDevice::where('push_token', 'shared')->count());
        $this->assertSame($other->id, $next->user_id);
        app(AuthService::class)->logout($other, '0');
        $this->assertNull($next->fresh()->push_token);
    }
}
