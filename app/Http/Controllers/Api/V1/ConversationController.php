<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\SendDriverMessagePush;
use App\Models\Conversation;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\User;
use App\Services\ConversationService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Throwable;

class ConversationController extends Controller
{
    public function __construct(private ConversationService $service) {}

    private function conversationData(Conversation $conversation, User $user): array
    {
        $conversation->loadMissing(['merchant', 'members.user', 'latestMessage.user', 'latestMessage.attachments']);

        return [
            'conversation_id' => $conversation->uuid, 'merchant_id' => $conversation->merchant->uuid,
            'type' => $conversation->type, 'driver_id' => $conversation->type === 'driver' ? $conversation->driver?->uuid : null,
            'title' => $conversation->title, 'description' => $conversation->description,
            'status' => $conversation->status, 'is_private' => $conversation->is_private,
            'can_manage' => $conversation->type === 'driver' ? $this->service->staff($user, $conversation->merchant) : $this->service->owner($user, $conversation),
            'members' => $conversation->members->where('state', 'active')->map(fn ($member) => [
                'user_id' => $member->user?->uuid, 'name' => $member->user?->name, 'role' => $member->role,
                'state' => $member->state, 'last_read_at' => $member->last_read_at?->toIso8601String(),
            ])->values(),
            'latest_message' => $conversation->latestMessage ? $this->messageData($conversation->latestMessage) : null,
            'updated_at' => $conversation->updated_at?->toIso8601String(),
        ];
    }

    private function messageData(Message $message): array
    {
        $message->loadMissing(['user', 'attachments']);

        return [
            'message_id' => $message->uuid, 'user_id' => $message->user?->uuid,
            'sender_name' => $message->user?->name ?? 'Deleted user', 'type' => $message->type,
            'temporary_id' => $message->temporary_id, 'body' => $message->body,
            'read_at' => $message->read_at?->toIso8601String(), 'created_at' => $message->created_at?->toIso8601String(),
            'attachments' => $message->attachments->map(fn ($attachment) => [
                'attachment_id' => $attachment->uuid, 'type' => $attachment->type, 'filename' => $attachment->filename,
                'mime_type' => $attachment->mime_type, 'size' => $attachment->size,
                'reference' => in_array($attachment->type, ['run', 'shipment']) ? ($attachment->meta['reference'] ?? null) : null,
            ]),
        ];
    }

    public function index(Request $request)
    {
        $data = $request->validate([
            'merchant_id' => 'nullable|uuid', 'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:100',
            'search' => 'nullable|string|max:255', 'type' => 'nullable|in:driver,normal',
            'has_messages' => 'nullable|boolean',
        ]);
        $user = $request->user();
        $merchant = $this->service->merchant($user, $data['merchant_id'] ?? $request->header('X-Merchant-Id'));
        $query = Conversation::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id);
        $query->where(function ($query) use ($user, $merchant) {
            $query->where(function ($query) use ($user) {
                $query->where('type', 'normal')->whereHas('members', fn ($q) => $q->where('user_id', $user->id)->where('state', 'active'));
            });
            if ($this->service->staff($user, $merchant)) {
                $query->orWhere(fn ($q) => $q->where('type', 'driver')->whereHas('driver', fn ($d) => $d->where('merchant_id', $merchant->id)->where('account_id', $merchant->account_id)));
            } elseif ($user->role === 'driver') {
                $query->orWhere(fn ($q) => $q->where('type', 'driver')->where('type_entry_id', $user->driver?->id));
            }
        });
        if ($request->boolean('has_messages')) {
            $query->whereHas('messages');
        }
        if (! empty($data['type'])) {
            $query->where('type', $data['type']);
        }
        $search = trim($data['search'] ?? '');
        if ($search !== '') {
            // Keep all search alternatives inside the authorized merchant query.
            $query->where(function ($query) use ($search) {
                $pattern = '%'.$search.'%';
                $query->where('title', 'like', $pattern)->orWhere('description', 'like', $pattern)
                    ->orWhereHas('members', fn ($members) => $members->where('state', 'active')
                        ->whereHas('user', fn ($users) => $users->where('name', 'like', $pattern)))
                    ->orWhere(fn ($drivers) => $drivers->where('type', 'driver')
                        ->whereHas('driver.user', fn ($users) => $users->where('name', 'like', $pattern)));
            });
        }
        $page = $query->with(['merchant', 'driver', 'members.user', 'latestMessage.user', 'latestMessage.attachments'])->orderByDesc('updated_at')->orderByDesc('id')->paginate($data['per_page'] ?? 20);

        return ApiResponse::success($page->getCollection()->map(fn ($c) => $this->conversationData($c, $user)), [
            'current_page' => $page->currentPage(), 'last_page' => $page->lastPage(), 'total' => $page->total(),
        ]);
    }

    public function unread(Request $request)
    {
        $data = $request->validate(['merchant_id' => 'required|uuid']);
        $user = $request->user();
        abort_if($user->role === 'driver', 403);
        $merchant = $this->service->merchant($user, $data['merchant_id']);
        $staff = $this->service->staff($user, $merchant);
        $count = Message::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)
            ->where(fn ($q) => $q->whereNull('user_id')->orWhere('user_id', '!=', $user->id))
            ->whereHas('conversation', function ($query) use ($user, $merchant, $staff) {
                $query->where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)
                    ->where(function ($query) use ($user, $merchant, $staff) {
                        $query->where(function ($normal) use ($user) {
                            $normal->where('type', 'normal')->whereHas('members', function ($member) use ($user) {
                                $member->where('user_id', $user->id)->where('state', 'active')
                                    ->where(fn ($cursor) => $cursor->whereNull('last_read_at')
                                        ->orWhereColumn('last_read_at', '<', 'messages.created_at'));
                            });
                        });
                        if ($staff) {
                            // Dispatch shares read receipts for incoming driver messages.
                            $query->orWhere(function ($driver) use ($merchant) {
                                $driver->where('type', 'driver')->whereNull('messages.read_at')
                                    ->whereHas('driver', fn ($d) => $d->where('merchant_id', $merchant->id)
                                        ->where('account_id', $merchant->account_id)
                                        ->whereColumn('drivers.user_id', 'messages.user_id'));
                            });
                        }
                    });
            })->count();

        return ApiResponse::success(['unread_count' => $count]);
    }

    public function driverUnread(Request $request)
    {
        $user = $request->user();
        abort_unless($user->role === 'driver', 403);
        $merchant = $this->service->merchant($user, null);
        $count = Message::where('account_id', $merchant->account_id)->where('merchant_id', $merchant->id)
            ->whereNull('read_at')->where('user_id', '!=', $user->id)
            ->whereHas('conversation', fn ($q) => $q->where('type', 'driver')->where('type_entry_id', $user->driver->id))
            ->count();

        return ApiResponse::success(['unread_count' => $count]);
    }

    public function participants(Request $request)
    {
        $data = $request->validate(['merchant_id' => 'required|uuid', 'search' => 'nullable|string|max:255', 'page' => 'nullable|integer|min:1']);
        $merchant = $this->service->merchant($request->user(), $data['merchant_id']);
        abort_unless($this->service->staff($request->user(), $merchant), 403);
        $query = User::where('account_id', $merchant->account_id)->where(function ($q) use ($merchant) {
            $q->whereHas('merchants', fn ($m) => $m->where('merchants.id', $merchant->id))
                ->orWhere('id', $merchant->owner_user_id)->orWhere('id', $merchant->account?->owner_user_id);
        });
        if (! empty($data['search'])) {
            $query->where(fn ($q) => $q->where('name', 'like', '%'.$data['search'].'%')->orWhere('email', 'like', '%'.$data['search'].'%'));
        }
        $rows = $query->orderBy('name')->paginate(100);

        return ApiResponse::success($rows->getCollection()->map(fn ($u) => ['user_id' => $u->uuid, 'name' => $u->name]), ['last_page' => $rows->lastPage()]);
    }

    public function driver(Request $request)
    {
        $data = $request->validate(['merchant_id' => 'nullable|uuid', 'driver_id' => 'nullable|uuid']);
        $user = $request->user();
        $merchant = $this->service->merchant($user, $data['merchant_id'] ?? $request->header('X-Merchant-Id'));
        abort_if($user->role !== 'driver' && empty($data['driver_id']), 422, 'Select a driver.');

        return ApiResponse::success($this->conversationData($this->service->driverChat($user, $merchant, $data['driver_id'] ?? null), $user));
    }

    public function store(Request $request)
    {
        $data = $request->validate(['merchant_id' => 'required|uuid', 'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:10000', 'member_ids' => 'required|array|min:1|max:100', 'member_ids.*' => 'required|uuid|distinct']);
        $user = $request->user();
        $merchant = $this->service->merchant($user, $data['merchant_id']);
        abort_unless($this->service->staff($user, $merchant), 403);
        $members = collect($data['member_ids'])->map(fn ($uuid) => $this->service->memberUser($merchant, $uuid))->reject(fn ($m) => $m->id === $user->id);
        if ($members->isEmpty()) {
            throw ValidationException::withMessages(['member_ids' => 'Select at least one additional member.']);
        }
        $conversation = DB::transaction(function () use ($data, $user, $merchant, $members) {
            $conversation = Conversation::create(['account_id' => $merchant->account_id, 'merchant_id' => $merchant->id,
                'type' => 'normal', 'title' => trim($data['title']), 'description' => $data['description'] ?? null]);
            $this->service->addMember($conversation, $user, 'owner');
            foreach ($members as $member) {
                $this->service->addMember($conversation, $member);
            }

            return $conversation;
        });

        return ApiResponse::success($this->conversationData($conversation, $user), [], 201);
    }

    public function show(Request $request, string $conversation_uuid)
    {
        return ApiResponse::success($this->conversationData($this->service->resolve($request->user(), $conversation_uuid), $request->user()));
    }

    public function update(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['title' => 'sometimes|required|string|max:255', 'description' => 'sometimes|nullable|string|max:10000', 'status' => 'sometimes|required|in:active,closed']);
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        abort_unless($conversation->type === 'driver' ? $this->service->staff($request->user(), $conversation->merchant) : $this->service->owner($request->user(), $conversation), 403);
        DB::transaction(function () use ($conversation, $data) {
            $locked = Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $locked->update($data);
        });

        return ApiResponse::success($this->conversationData($conversation->fresh(), $request->user()));
    }

    public function addMember(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['user_id' => 'required|uuid']);
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        abort_unless($conversation->type === 'normal' && $this->service->owner($request->user(), $conversation), 403);
        $user = $this->service->memberUser($conversation->merchant, $data['user_id']);
        DB::transaction(function () use ($conversation, $user) {
            Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            if (! $conversation->members()->where('user_id', $user->id)->where('state', 'active')->exists()) {
                $this->service->addMember($conversation, $user);
            }
        });

        return ApiResponse::success($this->conversationData($conversation->fresh(), $request->user()));
    }

    public function removeMember(Request $request, string $conversation_uuid, string $user_uuid)
    {
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        abort_unless($conversation->type === 'normal' && $this->service->owner($request->user(), $conversation), 403);
        DB::transaction(function () use ($conversation, $user_uuid) {
            Conversation::whereKey($conversation->id)->lockForUpdate()->firstOrFail();
            $member = $conversation->members()->whereHas('user', fn ($q) => $q->where('uuid', $user_uuid))->firstOrFail();
            abort_if($member->role === 'owner', 422, 'The owner cannot be removed.');
            $member->update(['state' => 'removed']);
        });

        return ApiResponse::success($this->conversationData($conversation->fresh(), $request->user()));
    }

    public function messages(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['before' => 'nullable|uuid', 'per_page' => 'nullable|integer|min:1|max:100']);
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        $query = $conversation->messages()->with(['user', 'attachments'])->orderByDesc('id');
        if (! empty($data['before'])) {
            $query->where('id', '<', $conversation->messages()->where('uuid', $data['before'])->firstOrFail()->id);
        }
        $limit = $data['per_page'] ?? 50;
        $rows = $query->limit($limit + 1)->get();
        $more = $rows->count() > $limit;
        $rows = $rows->take($limit);

        return ApiResponse::success($rows->reverse()->values()->map(fn ($m) => $this->messageData($m)), [
            'next_before' => $more ? $rows->last()->uuid : null,
        ]);
    }

    private function referenceQuery(Request $request, Conversation $conversation, string $type)
    {
        $driver = $request->user()->driver;
        abort_unless($conversation->type === 'driver' && $driver && $driver->is_active
            && (int) $conversation->type_entry_id === (int) $driver->id, 403);
        $runs = Run::query()->where('account_id', $conversation->account_id)
            ->where('merchant_id', $conversation->merchant_id)->where('driver_id', $driver->id)
            ->where('status', '!=', Run::STATUS_CANCELLED);
        if ($type === 'run') {
            return $runs;
        }

        return Shipment::query()->where('account_id', $conversation->account_id)
            ->where('merchant_id', $conversation->merchant_id)
            ->with(['runShipments' => fn ($q) => $q->where('status', '!=', RunShipment::STATUS_REMOVED)->whereIn('run_id', (clone $runs)->select('id'))->with('run')->orderByDesc('id')])
            ->whereHas('runShipments', fn ($q) => $q->where('status', '!=', RunShipment::STATUS_REMOVED)
                ->whereIn('run_id', $runs->select('id')));
    }

    private function referenceData($record, string $type): array
    {
        return ['id' => $record->uuid, 'type' => $type,
            'label' => $type === 'run' ? 'Run '.$record->id : ($record->merchant_order_ref ?: $record->delivery_note_number ?: $record->uuid),
            'subtitle' => str_replace('_', ' ', $record->status),
            'run_id' => $type === 'shipment' && $record->runShipments->first()?->run?->status === Run::STATUS_COMPLETED
                ? $record->runShipments->first()->run->uuid : null];
    }

    public function references(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['type' => 'required|in:run,shipment', 'search' => 'required|string|max:255', 'page' => 'sometimes|integer|min:1']);
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        $query = $this->referenceQuery($request, $conversation, $data['type']);
        $search = trim($data['search']);
        if ($data['type'] === 'run') {
            $query->where(function ($q) use ($search) {
                $q->where('uuid', 'like', '%'.$search.'%');
                if (preg_match('/^(?:run\s*)?(\d+)$/i', $search, $match)) {
                    $q->orWhere('id', (int) $match[1]);
                }
            });
        } else {
            $query->where(fn ($q) => $q->where('merchant_order_ref', 'like', '%'.$search.'%')
                ->orWhere('delivery_note_number', 'like', '%'.$search.'%')->orWhere('uuid', 'like', '%'.$search.'%'));
        }
        $page = $query->orderByDesc('id')->paginate(20);

        return ApiResponse::success($page->getCollection()->map(fn ($record) => $this->referenceData($record, $data['type'])),
            ['current_page' => $page->currentPage(), 'last_page' => $page->lastPage()]);
    }

    public function send(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['body' => 'nullable|string|max:10000', 'temporary_id' => 'required|string|max:255',
            'attachments' => 'nullable|array|max:5', 'attachments.*' => 'required|file|max:20480',
            'references' => 'nullable|array|max:5', 'references.*.type' => 'required|in:run,shipment', 'references.*.id' => 'required|uuid']);
        $files = $request->file('attachments', []);
        $body = trim($data['body'] ?? '');
        if (count($files) + count($data['references'] ?? []) > 5) {
            throw ValidationException::withMessages(['attachments' => 'Choose up to five attachments.']);
        }
        if (! $body && ! $files && empty($data['references'])) {
            throw ValidationException::withMessages(['body' => 'Enter a message or add an attachment.']);
        }
        $user = $request->user();
        $conversation = $this->service->resolve($user, $conversation_uuid);
        $stored = [];
        try {
            [$message, $created] = DB::transaction(function () use ($request, $conversation, $user, $data, $body, $files, &$stored) {
                $locked = Conversation::with(['merchant', 'driver'])->whereKey($conversation->id)->lockForUpdate()->firstOrFail();
                abort_unless($this->service->canAccess($user, $locked), 403);
                $existing = $locked->messages()->where('user_id', $user->id)->where('temporary_id', $data['temporary_id'])->first();
                if ($existing) {
                    return [$existing, false];
                }
                abort_unless($locked->status === 'active', 409, 'This conversation is closed.');
                $message = $locked->messages()->create(['account_id' => $locked->account_id, 'merchant_id' => $locked->merchant_id,
                    'user_id' => $user->id, 'temporary_id' => $data['temporary_id'], 'body' => $body ?: null, 'type' => $files || ! empty($data['references']) ? 'file' : 'text']);
                foreach ($data['references'] ?? [] as $reference) {
                    $record = $this->referenceQuery($request, $locked, $reference['type'])->where('uuid', $reference['id'])->firstOrFail();
                    $info = $this->referenceData($record, $reference['type']);
                    $message->attachments()->create(['account_id' => $locked->account_id, 'merchant_id' => $locked->merchant_id,
                        'type' => $info['type'], 'path' => 'reference/'.$info['type'].'/'.$info['id'],
                        'filename' => $info['label'], 'meta' => ['reference' => $info]]);
                }
                $disk = config('filesystems.default');
                foreach ($files as $file) {
                    $path = $file->store("messages/{$locked->account_id}/{$locked->merchant_id}/{$message->uuid}", ['disk' => $disk, 'visibility' => 'private']);
                    if (! $path) {
                        throw new \RuntimeException('Unable to store attachment.');
                    }
                    $stored[] = [$disk, $path];
                    $message->attachments()->create(['account_id' => $locked->account_id, 'merchant_id' => $locked->merchant_id,
                        'type' => str_starts_with($file->getMimeType() ?? '', 'image/') ? 'image' : 'file', 'path' => $path,
                        'filename' => basename($file->getClientOriginalName()), 'mime_type' => $file->getMimeType(),
                        'size' => $file->getSize(), 'meta' => ['disk' => $disk]]);
                }
                $locked->touch();
                if ($locked->type === 'driver' && (int) $locked->driver?->user_id !== (int) $user->id) {
                    DB::afterCommit(function () use ($message) {
                        try {
                            SendDriverMessagePush::dispatch($message->id)->onConnection(config('queue.default') === 'sync' ? 'database' : config('queue.default'));
                        } catch (Throwable $error) {
                            // A queue outage must not roll back an already committed message or delete its files.
                            report($error);
                        }
                    });
                }

                return [$message, true];
            });
        } catch (Throwable $error) {
            foreach ($stored as [$disk, $path]) {
                Storage::disk($disk)->delete($path);
            }
            throw $error;
        }

        return ApiResponse::success($this->messageData($message), [], $created ? 201 : 200);
    }

    public function read(Request $request, string $conversation_uuid)
    {
        $data = $request->validate(['message_id' => 'required|uuid']);
        $user = $request->user();
        $conversation = $this->service->resolve($user, $conversation_uuid);
        $message = $conversation->messages()->where('uuid', $data['message_id'])->firstOrFail();
        if ($conversation->type === 'normal') {
            $conversation->members()->where('user_id', $user->id)->where('state', 'active')
                ->where(fn ($q) => $q->whereNull('last_read_at')->orWhere('last_read_at', '<', $message->created_at))
                ->update(['last_read_at' => $message->created_at]);
        } else {
            $query = $conversation->messages()->where('id', '<=', $message->id)->whereNull('read_at');
            $driverUser = $conversation->driver->user_id;
            if ((int) $user->id === (int) $driverUser) {
                $query->where('user_id', '!=', $driverUser);
            } else {
                $query->where('user_id', $driverUser);
            }
            $query->update(['read_at' => now()]);
        }

        return ApiResponse::success(['read' => true]);
    }

    public function download(Request $request, string $conversation_uuid, string $attachment_uuid)
    {
        $conversation = $this->service->resolve($request->user(), $conversation_uuid);
        $attachment = MessageAttachment::where('uuid', $attachment_uuid)->where('account_id', $conversation->account_id)
            ->where('merchant_id', $conversation->merchant_id)->whereHas('message', fn ($q) => $q->where('conversation_id', $conversation->id))->firstOrFail();
        abort_if(in_array($attachment->type, ['run', 'shipment']), 422, 'This attachment is a record reference, not a downloadable file.');
        $disk = Storage::disk($attachment->meta['disk'] ?? config('filesystems.default'));
        abort_unless($disk->exists($attachment->path), 404);

        return ApiResponse::success(['url' => $disk->temporaryUrl($attachment->path, now()->addMinutes(5))]);
    }
}
