<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DeliveryNoteImport;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Services\DeliveryNoteImportService;
use App\Services\RunService;
use App\Support\ApiResponse;
use App\Support\MerchantAccess;
use Illuminate\Http\Request;

/** Shared asynchronous analysis; extraction never creates shipments or runs. */
class DeliveryNoteAnalysisController extends Controller
{
    public function analyze(Request $request, DeliveryNoteImportService $service, RunService $runs)
    {
        abort_unless($request->user(), 403);
        if ($request->user()->role === 'driver') {
            $request->merge(['async' => '1']);
            return app(DriverDocumentImportController::class)->store($request, $service);
        }
        $data = $request->validate([
            'file' => ['required', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:20480'],
            'import_id' => ['required', 'uuid'], 'run_id' => ['nullable', 'uuid'],
            'environment_id' => ['nullable', 'uuid'],
        ]);
        $merchant = $this->merchant($request);
        $this->authorize('create', [Shipment::class, $merchant]);
        $environment = $this->environment($request, $merchant);
        $run = empty($data['run_id']) ? null : $runs->getRunForUser($request->user(), $data['run_id'], $environment);
        if ($run) {
            abort_unless($run->merchant_id === $merchant->id && in_array($run->status, ['draft', 'dispatched', 'in_progress'], true), 404);
            $this->authorize('update', $run);
        }
        $import = $service->queueDocument($request->user(), $request->file('file'), $merchant, $run, $data['import_id'], $environment?->id);
        return ApiResponse::success($service->processingPayload($import), [], 202);
    }

    public function status(Request $request, string $id, DeliveryNoteImportService $service)
    {
        abort_unless($request->user(), 403);
        if ($request->user()->role === 'driver') {
            return app(DriverDocumentImportController::class)->show($request, $id);
        }
        $merchant = $this->merchant($request);
        abort_unless(MerchantAccess::isSuperAdmin($request->user()) || MerchantAccess::canViewResources($request->user(), $merchant), 403);
        $environment = $this->environment($request, $merchant);
        $import = DeliveryNoteImport::where('uuid', $id)->where('merchant_id', $merchant->id)->where('account_id', $merchant->account_id)
            ->when($environment, fn ($query) => $query->where('environment_id', $environment->id))->firstOrFail();
        return ApiResponse::success($service->processingPayload($import));
    }

    private function merchant(Request $request): Merchant
    {
        abort_unless(in_array($request->user()->role, ['user', 'super_admin'], true), 403);
        $merchant = $request->attributes->get('merchant');
        if (!$merchant) {
            $id = $request->header('X-Merchant-Id') ?: ($request->input('merchant_id') ?? $request->input('merchant_uuid'));
            abort_unless($id, 422, 'Select a merchant for document analysis.');
            $merchant = Merchant::where('uuid', $id)->firstOrFail();
        }
        return $merchant;
    }

    private function environment(Request $request, Merchant $merchant)
    {
        $environment = $request->attributes->get('merchant_environment');
        if ($environment) {
            abort_unless($environment->merchant_id === $merchant->id, 404);
            return $environment;
        }
        $id = $request->input('environment_id') ?? $request->input('environment_uuid');
        return $id ? $merchant->environments()->where('uuid', $id)->firstOrFail() : null;
    }
}
