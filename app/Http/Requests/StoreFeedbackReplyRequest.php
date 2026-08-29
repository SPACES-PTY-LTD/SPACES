<?php

namespace App\Http\Requests;

use App\Models\Feedback;
use Illuminate\Validation\Rule;

class StoreFeedbackReplyRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['user', 'super_admin'], true);
    }

    protected function prepareForValidation()
    {
        parent::prepareForValidation();
        $this->merge(['message' => is_string($this->message) ? trim($this->message) : $this->message]);
    }

    public function rules(): array
    {
        return [
            'message' => ['required', 'string', 'min:1', 'max:5000'],
            'status' => ['nullable', Rule::in(Feedback::STATUSES)],
        ];
    }
}
