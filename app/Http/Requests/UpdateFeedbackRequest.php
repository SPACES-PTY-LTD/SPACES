<?php

namespace App\Http\Requests;

use App\Models\Feedback;
use Illuminate\Validation\Rule;

class UpdateFeedbackRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['user', 'super_admin'], true);
    }

    public function rules(): array
    {
        return [
            'status' => ['sometimes', Rule::in(Feedback::STATUSES)],
            'assignment' => ['sometimes', Rule::in(['self', 'unassigned'])],
        ];
    }
}
