<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeedbackResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $latestMessage = $this->relationLoaded('latestMessage') ? $this->latestMessage : null;

        return [
            'feedback_id' => $this->uuid,
            'category' => $this->category,
            'status' => $this->status,
            'page_path' => $this->page_path,
            'submitter' => $this->submitter ? [
                'user_id' => $this->submitter->uuid,
                'name' => $this->submitter->name,
                'email' => $this->submitter->email,
            ] : null,
            'merchant' => $this->merchant ? [
                'merchant_id' => $this->merchant->uuid,
                'name' => $this->merchant->name,
            ] : null,
            'assignee' => $this->assignee ? [
                'user_id' => $this->assignee->uuid,
                'name' => $this->assignee->name,
                'email' => $this->assignee->email,
            ] : null,
            'status_updated_by' => $this->whenLoaded('statusUpdatedBy', fn () => $this->statusUpdatedBy ? [
                'user_id' => $this->statusUpdatedBy->uuid,
                'name' => $this->statusUpdatedBy->name,
            ] : null),
            'status_updated_at' => optional($this->status_updated_at)?->toIso8601String(),
            'message_preview' => $latestMessage?->body,
            'message_count' => (int) ($this->messages_count ?? 0),
            'unread' => (bool) ($this->unread ?? false),
            'messages' => FeedbackMessageResource::collection($this->whenLoaded('messages')),
            'created_at' => optional($this->created_at)?->toIso8601String(),
            'updated_at' => optional($this->updated_at)?->toIso8601String(),
        ];
    }
}
