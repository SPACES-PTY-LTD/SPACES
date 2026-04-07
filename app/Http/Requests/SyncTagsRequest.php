<?php

namespace App\Http\Requests;

class SyncTagsRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tags' => ['required', 'array', 'max:50'],
            'tags.*' => ['nullable', 'string', 'max:80'],
        ];
    }
}
