<?php

namespace App\Http\Requests;

use App\Models\LocationType;
use App\Models\Merchant;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateMerchantLocationAutomationRequest extends BaseRequest
{
    private const ACTION_TYPES = [
        'record_vehicle_entry',
        'record_vehicle_exit',
        'start_run',
        'create_shipment',
    ];

    private const CONDITION_FIELDS = [
        'has_active_run',
        'run_status',
        'shipment_exists_for_location',
        'shipment_status',
        'location_matches_run_origin',
        'location_matches_run_destination',
    ];

    private const CONDITION_OPERATORS = [
        'equals',
        'not_equals',
    ];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $actionRules = ['required', 'array'];
        $conditionRules = ['sometimes', 'array'];

        return [
            'enabled' => ['sometimes', 'boolean'],
            'location_types' => ['sometimes', 'array'],
            'location_types.*.location_type_id' => ['required', 'uuid', 'exists:location_types,uuid'],
            'location_types.*.entry' => $actionRules,
            'location_types.*.entry.*.id' => ['required', 'string', 'max:100'],
            'location_types.*.entry.*.action' => ['required', Rule::in(self::ACTION_TYPES)],
            'location_types.*.entry.*.conditions' => $conditionRules,
            'location_types.*.entry.*.conditions.*.id' => ['required', 'string', 'max:100'],
            'location_types.*.entry.*.conditions.*.field' => ['required', Rule::in(self::CONDITION_FIELDS)],
            'location_types.*.entry.*.conditions.*.operator' => ['required', Rule::in(self::CONDITION_OPERATORS)],
            'location_types.*.entry.*.conditions.*.value' => ['required', 'string', 'max:255'],
            'location_types.*.exit' => $actionRules,
            'location_types.*.exit.*.id' => ['required', 'string', 'max:100'],
            'location_types.*.exit.*.action' => ['required', Rule::in(self::ACTION_TYPES)],
            'location_types.*.exit.*.conditions' => $conditionRules,
            'location_types.*.exit.*.conditions.*.id' => ['required', 'string', 'max:100'],
            'location_types.*.exit.*.conditions.*.field' => ['required', Rule::in(self::CONDITION_FIELDS)],
            'location_types.*.exit.*.conditions.*.operator' => ['required', Rule::in(self::CONDITION_OPERATORS)],
            'location_types.*.exit.*.conditions.*.value' => ['required', 'string', 'max:255'],
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator) {
            $merchantUuid = $this->route('merchant_uuid');
            if (!$merchantUuid) {
                return;
            }

            $merchantId = Merchant::query()->where('uuid', $merchantUuid)->value('id');
            if (!$merchantId) {
                return;
            }

            $locationTypeUuids = collect($this->input('location_types', []))
                ->pluck('location_type_id')
                ->filter()
                ->unique()
                ->values();

            if ($locationTypeUuids->isEmpty()) {
                return;
            }

            $ownedCount = LocationType::query()
                ->where('merchant_id', $merchantId)
                ->whereIn('uuid', $locationTypeUuids)
                ->count();

            if ($ownedCount !== $locationTypeUuids->count()) {
                $validator->errors()->add('location_types', 'All location_type_id values must belong to the route merchant.');
            }
        });
    }
}
