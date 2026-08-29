<?php

namespace App\Http\Requests;

use App\Models\Feedback;
use Illuminate\Validation\Rule;

class StoreFeedbackRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return in_array($this->user()?->role, ['user', 'super_admin'], true);
    }

    protected function prepareForValidation()
    {
        parent::prepareForValidation();
        $this->merge([
            'message' => is_string($this->message) ? trim($this->message) : $this->message,
            'page_path' => is_string($this->page_path) ? trim($this->page_path) : $this->page_path,
        ]);
    }

    public function rules(): array
    {
        return [
            'merchant_id' => [Rule::requiredIf($this->user()?->role !== 'super_admin'), 'nullable', 'uuid', 'exists:merchants,uuid'],
            'category' => ['required', Rule::in(Feedback::CATEGORIES)],
            'message' => ['required', 'string', 'min:1', 'max:5000'],
            'page_path' => ['required', 'string', 'max:2048', 'regex:/^\/admin(?:\/|$)/'],
        ];
    }
}
