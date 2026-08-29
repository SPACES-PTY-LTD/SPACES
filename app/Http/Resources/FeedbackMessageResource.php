<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class FeedbackMessageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'message_id' => $this->uuid,
            'author_type' => $this->author_type,
            'body' => $this->body,
            'sender' => $this->sender ? [
                'user_id' => $this->sender->uuid,
                'name' => $this->sender->name,
                'email' => $this->sender->email,
            ] : null,
            'created_at' => optional($this->created_at)?->toIso8601String(),
        ];
    }
}
