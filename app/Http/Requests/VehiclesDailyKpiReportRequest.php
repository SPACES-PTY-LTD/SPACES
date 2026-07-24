<?php

namespace App\Http\Requests;

class VehiclesDailyKpiReportRequest extends BaseRequest
{
    protected function prepareForValidation(): void
    {
        parent::prepareForValidation();

        if ($this->has('only_with_data')) {
            $value = filter_var($this->input('only_with_data'), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($value !== null) {
                $this->merge(['only_with_data' => $value]);
            }
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'merchant_id' => ['nullable', 'uuid', 'exists:merchants,uuid'],
            'year' => ['required', 'integer', 'min:2000', 'max:9999'],
            'month' => ['required', 'integer', 'between:1,12'],
            'only_with_data' => ['nullable', 'boolean'],
        ];
    }
}
