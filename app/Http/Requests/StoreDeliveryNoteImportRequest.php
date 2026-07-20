<?php

namespace App\Http\Requests;

class StoreDeliveryNoteImportRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:20480', 'mimetypes:application/pdf,image/jpeg,image/png,image/webp'],
        ];
    }
}
