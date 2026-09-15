<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\AdditionalCostResource;
use App\Models\Location;
use App\Models\LocationCost;
use App\Models\Run;
use App\Services\ActivityLogService;
use App\Support\ApiResponse;
use App\Support\CostMoney;
use App\Support\MerchantAccess;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Throwable;

class AdditionalCostController extends Controller
{
    public function handle(Request $request)
    {
        try {
            return DB::transaction(function () use ($request) {
                $isRun = $request->route('run_uuid') !== null;
                $class = $isRun ? Run::class : Location::class;
                $query = $class::where('uuid', $request->route($isRun ? 'run_uuid' : 'location_uuid'));
                if ($environment = $request->attributes->get('merchant_environment')) {
                    $query->where('merchant_id', $environment->merchant_id)->where('environment_id', $environment->id);
                }
                $parent = $query->lockForUpdate()->firstOrFail();
                $user = $request->user();
                if (! $user) {
                    throw new AuthorizationException;
                }
                $read = $request->isMethod('GET');
                $allowed = MerchantAccess::isSuperAdmin($user) || ($read
                    ? MerchantAccess::canViewResources($user, $parent->merchant)
                    : ($request->isMethod('DELETE') ? MerchantAccess::canDeleteResources($user, $parent->merchant) : MerchantAccess::canCreateOrUpdateResources($user, $parent->merchant)));
                if (! $allowed) {
                    throw new AuthorizationException;
                }
                if ($read) {
                    return ApiResponse::success($this->summary($parent));
                }

                $costUuid = $request->route('cost_uuid');
                $cost = $costUuid ? $parent->additionalCosts()->where('uuid', $costUuid)->firstOrFail() : null;
                $before = $cost ? (new AdditionalCostResource($cost))->resolve($request) : null;
                if ($request->isMethod('DELETE')) {
                    $cost->delete();
                    $action = 'deleted';
                } else {
                    $data = $request->validate([
                        'title' => [$cost ? 'sometimes' : 'nullable', 'string', 'max:255', 'regex:/\S/u'],
                        'amount' => [$cost ? 'sometimes' : 'nullable', 'string'],
                        'source' => [$isRun && ! $cost ? 'required' : 'prohibited', Rule::in(['manual', 'geofence'])],
                        'location_cost_id' => [$isRun && ! $cost ? 'nullable' : 'prohibited', 'uuid'],
                        'currency' => ['prohibited'],
                    ]);
                    $attributes = [];
                    $currency = $cost?->currency ?? $parent->merchant->currency ?? 'ZAR';
                    if ($isRun && ! $cost) {
                        $attributes = ['source' => $data['source'], 'created_by' => $user->id];
                        if ($data['source'] === 'geofence') {
                            $configured = LocationCost::query()->where('uuid', $data['location_cost_id'] ?? '')
                                ->whereHas('location', fn ($q) => $q->where('merchant_id', $parent->merchant_id)->where('environment_id', $parent->environment_id))
                                ->with('location')->firstOrFail();
                            $attributes += [
                                'location_id' => $configured->location_id,
                                'location_cost_id' => $configured->id,
                                'location_name' => $configured->location->name,
                            ];
                            $currency = $configured->currency;
                            $data['title'] ??= $configured->title;
                            $data['amount'] ??= CostMoney::format(CostMoney::units($configured->amount), $currency);
                        } elseif (! empty($data['location_cost_id'])) {
                            throw \Illuminate\Validation\ValidationException::withMessages(['location_cost_id' => 'Manual costs cannot reference a geofence cost.']);
                        }
                    }
                    $title = trim($data['title'] ?? $cost?->title ?? '');
                    if ($title === '') {
                        throw \Illuminate\Validation\ValidationException::withMessages(['title' => 'A title is required.']);
                    }
                    $amount = $data['amount'] ?? ($cost ? CostMoney::format(CostMoney::units($cost->amount), $currency) : null);
                    $attributes += ['title' => $title, 'amount' => CostMoney::validateAmount($amount, $currency), 'currency' => $currency];
                    if ($isRun) {
                        $attributes['updated_by'] = $user->id;
                    }
                    if ($cost) {
                        $cost->update($attributes);
                        $action = 'updated';
                    } else {
                        $cost = $parent->additionalCosts()->create($attributes);
                        $action = 'created';
                    }
                }
                app(ActivityLogService::class)->log(
                    action: 'additional_cost_'.$action,
                    entityType: $isRun ? 'run' : 'location',
                    entity: $parent,
                    actor: $user,
                    changes: ['before' => $before, 'after' => $action === 'deleted' ? null : (new AdditionalCostResource($cost))->resolve($request)],
                    metadata: ['cost_id' => $cost->uuid],
                    title: 'Additional cost '.$action,
                );

                return ApiResponse::success($this->summary($parent), [], $request->isMethod('POST') ? 201 : 200);
            });
        } catch (Throwable $e) {
            return $this->apiError($e, 'ADDITIONAL_COST_FAILED', 'Unable to process additional costs.');
        }
    }

    private function summary(Run|Location $parent): array
    {
        $costs = $parent->additionalCosts()->get();

        return [
            'additional_costs' => AdditionalCostResource::collection($costs),
            'additional_cost_totals' => CostMoney::totals($costs),
            'default_currency' => $parent->merchant->currency ?? 'ZAR',
            'can_edit' => MerchantAccess::isSuperAdmin(request()->user()) || MerchantAccess::canCreateOrUpdateResources(request()->user(), $parent->merchant),
            'can_delete' => MerchantAccess::isSuperAdmin(request()->user()) || MerchantAccess::canDeleteResources(request()->user(), $parent->merchant),
        ];
    }
}
