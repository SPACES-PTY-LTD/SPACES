<?php

namespace App\Http\Requests;

class UpdateMerchantBillingPlanRequest extends BaseRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'plan_id' => ['required', 'uuid', 'exists:pricing_plans,uuid'],
        ];
    }
}
