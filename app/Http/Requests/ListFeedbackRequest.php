<?php

namespace App\Http\Requests;

use App\Models\Feedback;
use Illuminate\Validation\Rule;

class ListFeedbackRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['user', 'super_admin'], true);
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', Rule::in(Feedback::STATUSES)],
            'category' => ['nullable', Rule::in(Feedback::CATEGORIES)],
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'assigned_to' => ['nullable', Rule::in(['me', 'unassigned'])],
            'search' => ['nullable', 'string', 'max:255'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ];
    }
}
