<?php

namespace App\Services;

use App\Jobs\SendFeedbackReplyEmailJob;
use App\Models\Feedback;
use App\Models\FeedbackMessage;
use App\Models\FeedbackReadReceipt;
use App\Models\Merchant;
use App\Models\User;
use App\Support\MerchantAccess;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class FeedbackService
{
    public function create(User $user, array $data, ?string $userAgent): Feedback
    {
        $merchant = $this->resolveSubmissionMerchant($user, $data['merchant_id'] ?? null);

        return DB::transaction(function () use ($user, $data, $merchant, $userAgent) {
            $feedback = Feedback::query()->create([
                'account_id' => $merchant?->account_id ?? $user->account_id,
                'merchant_id' => $merchant?->id,
                'submitted_by_user_id' => $user->id,
                'category' => $data['category'],
                'status' => 'open',
                'page_path' => $data['page_path'],
                'user_agent' => $userAgent ? mb_substr($userAgent, 0, 512) : null,
            ]);

            $message = $feedback->messages()->create([
                'sender_user_id' => $user->id,
                'author_type' => 'submitter',
                'body' => trim($data['message']),
            ]);

            $feedback->touch();
            $this->markRead($feedback, $user, $message->id);

            return $this->loadDetail($feedback, $user, 'submitter');
        });
    }

    public function listMine(User $user, array $filters): LengthAwarePaginator
    {
        $query = Feedback::query()
            ->where('submitted_by_user_id', $user->id)
            ->orderByDesc('updated_at');

        $this->applyFilters($query, $filters, false);

        return $this->paginateWithViewer($query, $user, 'submitter', $filters);
    }

    public function getMine(User $user, string $uuid): Feedback
    {
        $feedback = Feedback::query()
            ->where('submitted_by_user_id', $user->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        return $this->loadDetail($feedback, $user, 'submitter');
    }

    public function deleteMine(User $user, string $uuid): void
    {
        Feedback::query()
            ->where('submitted_by_user_id', $user->id)
            ->where('uuid', $uuid)
            ->firstOrFail()
            ->delete();
    }

    public function listForReview(User $user, array $filters): LengthAwarePaginator
    {
        $query = $this->reviewerQuery($user)->orderByDesc('updated_at');
        $this->applyFilters($query, $filters, true);

        return $this->paginateWithViewer($query, $user, 'reviewer', $filters);
    }

    public function getForReview(User $user, string $uuid): Feedback
    {
        $feedback = $this->reviewerQuery($user)->where('uuid', $uuid)->firstOrFail();

        return $this->loadDetail($feedback, $user, 'reviewer');
    }

    public function replyAsSubmitter(User $user, string $uuid, string $body): Feedback
    {
        $feedback = Feedback::query()
            ->where('submitted_by_user_id', $user->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        $recipientId = $feedback->assigned_to_user_id;

        $message = DB::transaction(function () use ($feedback, $user, $body) {
            $message = $feedback->messages()->create([
                'sender_user_id' => $user->id,
                'author_type' => 'submitter',
                'body' => trim($body),
            ]);

            if ($feedback->status === 'closed') {
                $feedback->forceFill([
                    'status' => 'open',
                    'status_updated_by_user_id' => $user->id,
                    'status_updated_at' => now(),
                ]);
            } elseif ($feedback->status === 'needs_info') {
                $feedback->forceFill([
                    'status' => 'in_progress',
                    'status_updated_by_user_id' => $user->id,
                    'status_updated_at' => now(),
                ]);
            }

            $feedback->touch();
            $feedback->save();
            $this->markRead($feedback, $user, $message->id);

            return $message;
        });

        if ($recipientId) {
            SendFeedbackReplyEmailJob::dispatch($feedback->id, $message->id, $recipientId, 'reviewer')->afterCommit();
        }

        return $this->loadDetail($feedback->fresh(), $user, 'submitter');
    }

    public function replyAsReviewer(User $user, string $uuid, string $body, ?string $status = null): Feedback
    {
        $feedback = $this->reviewerQuery($user)->where('uuid', $uuid)->firstOrFail();

        $message = DB::transaction(function () use ($feedback, $user, $body, $status) {
            $message = $feedback->messages()->create([
                'sender_user_id' => $user->id,
                'author_type' => 'reviewer',
                'body' => trim($body),
            ]);

            $changes = [];
            if (! $feedback->assigned_to_user_id) {
                $changes['assigned_to_user_id'] = $user->id;
            }
            if ($status && $status !== $feedback->status) {
                $changes['status'] = $status;
                $changes['status_updated_by_user_id'] = $user->id;
                $changes['status_updated_at'] = now();
            }

            $feedback->forceFill($changes);
            $feedback->touch();
            $feedback->save();
            $this->markRead($feedback, $user, $message->id);

            return $message;
        });

        if ($feedback->submitted_by_user_id) {
            SendFeedbackReplyEmailJob::dispatch(
                $feedback->id,
                $message->id,
                $feedback->submitted_by_user_id,
                'submitter'
            )->afterCommit();
        }

        return $this->loadDetail($feedback->fresh(), $user, 'reviewer');
    }

    public function updateForReview(User $user, string $uuid, array $data): Feedback
    {
        $feedback = $this->reviewerQuery($user)->where('uuid', $uuid)->firstOrFail();
        $changes = [];

        if (array_key_exists('status', $data) && $data['status'] !== $feedback->status) {
            $changes['status'] = $data['status'];
            $changes['status_updated_by_user_id'] = $user->id;
            $changes['status_updated_at'] = now();
        }

        if (array_key_exists('assignment', $data)) {
            $changes['assigned_to_user_id'] = $data['assignment'] === 'self' ? $user->id : null;
        }

        if ($changes !== []) {
            $feedback->forceFill($changes)->save();
        }

        return $this->loadDetail($feedback->fresh(), $user, 'reviewer');
    }

    public function markMineRead(User $user, string $uuid): Feedback
    {
        $feedback = Feedback::query()
            ->where('submitted_by_user_id', $user->id)
            ->where('uuid', $uuid)
            ->firstOrFail();

        $this->markRead($feedback, $user);

        return $this->loadDetail($feedback, $user, 'submitter');
    }

    public function markReviewerRead(User $user, string $uuid): Feedback
    {
        $feedback = $this->reviewerQuery($user)->where('uuid', $uuid)->firstOrFail();
        $this->markRead($feedback, $user);

        return $this->loadDetail($feedback, $user, 'reviewer');
    }

    public function unreadMineCount(User $user): int
    {
        return $this->countUnread(
            Feedback::query()->where('submitted_by_user_id', $user->id),
            $user,
            'submitter'
        );
    }

    public function unreadReviewerCount(User $user): int
    {
        return $this->countUnread($this->reviewerQuery($user), $user, 'reviewer');
    }

    private function resolveSubmissionMerchant(User $user, ?string $merchantUuid): ?Merchant
    {
        if (! $merchantUuid) {
            if ($user->role === 'super_admin') {
                return null;
            }

            throw new AuthorizationException('A merchant is required.');
        }

        $merchant = Merchant::query()->where('uuid', $merchantUuid)->firstOrFail();
        if ($user->role !== 'super_admin' && ! MerchantAccess::hasMerchantAccess($user, $merchant)) {
            throw new AuthorizationException;
        }

        return $merchant;
    }

    private function reviewerQuery(User $user): Builder
    {
        $merchantIds = MerchantAccess::manageableMerchantIds($user);
        if ($merchantIds === []) {
            throw new AuthorizationException;
        }

        $query = Feedback::query();
        if ($merchantIds !== null) {
            $query->whereIn('merchant_id', $merchantIds);
        }

        return $query;
    }

    private function applyFilters(Builder $query, array $filters, bool $reviewer): void
    {
        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['category'])) {
            $query->where('category', $filters['category']);
        }
        if ($reviewer && ! empty($filters['merchant_id'])) {
            $query->whereHas('merchant', fn (Builder $builder) => $builder->where('uuid', $filters['merchant_id']));
        }
        if ($reviewer && ! empty($filters['assigned_to'])) {
            if ($filters['assigned_to'] === 'unassigned') {
                $query->whereNull('assigned_to_user_id');
            } elseif ($filters['assigned_to'] === 'me') {
                $query->where('assigned_to_user_id', request()->user()->id);
            }
        }
        if (! empty($filters['search'])) {
            $search = '%'.str_replace(['%', '_'], ['\\%', '\\_'], trim($filters['search'])).'%';
            $query->where(function (Builder $builder) use ($search) {
                $builder->where('page_path', 'like', $search)
                    ->orWhereHas('submitter', fn (Builder $userQuery) => $userQuery
                        ->where('name', 'like', $search)
                        ->orWhere('email', 'like', $search))
                    ->orWhereHas('messages', fn (Builder $messageQuery) => $messageQuery->where('body', 'like', $search));
            });
        }
    }

    private function paginateWithViewer(Builder $query, User $user, string $viewerType, array $filters): LengthAwarePaginator
    {
        $paginator = $query
            ->with(['submitter', 'merchant', 'assignee', 'latestMessage.sender'])
            ->withCount('messages')
            ->paginate(min((int) ($filters['per_page'] ?? 20), 100));

        $paginator->getCollection()->each(fn (Feedback $feedback) => $this->setViewerState($feedback, $user, $viewerType));

        return $paginator;
    }

    private function loadDetail(Feedback $feedback, User $user, string $viewerType): Feedback
    {
        $feedback->load(['submitter', 'merchant', 'assignee', 'statusUpdatedBy', 'messages.sender']);
        $feedback->loadCount('messages');

        return $this->setViewerState($feedback, $user, $viewerType);
    }

    private function setViewerState(Feedback $feedback, User $user, string $viewerType): Feedback
    {
        $receipt = FeedbackReadReceipt::query()
            ->where('feedback_id', $feedback->id)
            ->where('user_id', $user->id)
            ->first();
        $oppositeType = $viewerType === 'reviewer' ? 'submitter' : 'reviewer';
        $latestOppositeMessageId = FeedbackMessage::query()
            ->where('feedback_id', $feedback->id)
            ->where('author_type', $oppositeType)
            ->max('id');

        $feedback->setAttribute(
            'unread',
            $latestOppositeMessageId !== null && (! $receipt || $latestOppositeMessageId > $receipt->last_read_message_id)
        );
        $feedback->setAttribute('viewer_type', $viewerType);

        return $feedback;
    }

    private function countUnread(Builder $query, User $user, string $viewerType): int
    {
        return $query->pluck('id')->filter(function ($feedbackId) use ($user, $viewerType) {
            $lastReadMessageId = FeedbackReadReceipt::query()
                ->where('feedback_id', $feedbackId)
                ->where('user_id', $user->id)
                ->value('last_read_message_id');
            $oppositeType = $viewerType === 'reviewer' ? 'submitter' : 'reviewer';
            $latestMessageId = FeedbackMessage::query()
                ->where('feedback_id', $feedbackId)
                ->where('author_type', $oppositeType)
                ->max('id');

            return $latestMessageId !== null && ($lastReadMessageId === null || $latestMessageId > $lastReadMessageId);
        })->count();
    }

    private function markRead(Feedback $feedback, User $user, ?int $messageId = null): void
    {
        $messageId ??= FeedbackMessage::query()->where('feedback_id', $feedback->id)->max('id');
        FeedbackReadReceipt::query()->updateOrCreate(
            ['feedback_id' => $feedback->id, 'user_id' => $user->id],
            ['last_read_message_id' => $messageId, 'last_read_at' => now()]
        );
    }
}
