<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\ConfirmDeliveryNoteImportRequest;
use App\Http\Requests\StoreDeliveryNoteImportRequest;
use App\Http\Resources\DeliveryNoteImportResource;
use App\Http\Resources\RunResource;
use App\Models\DeliveryNoteImport;
use App\Services\DeliveryNoteImportService;
use App\Services\RunService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class DeliveryNoteImportController extends Controller
{
    public function store(
        string $run_uuid,
        StoreDeliveryNoteImportRequest $request,
        RunService $runs,
        DeliveryNoteImportService $service
    ) {
        try {
            $run = $runs->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);
            $import = $service->analyze($run, $request->user(), $request->file('file'));

            return ApiResponse::success(new DeliveryNoteImportResource($import), [], Response::HTTP_CREATED);
        } catch (Throwable $exception) {
            Log::error('Delivery note analysis failed', ['run_id' => $run_uuid, 'error' => $exception->getMessage()]);

            return $this->apiError($exception, 'DELIVERY_NOTE_ANALYSIS_FAILED', 'Unable to analyze delivery note.');
        }
    }

    public function confirm(
        string $run_uuid,
        string $import_uuid,
        ConfirmDeliveryNoteImportRequest $request,
        RunService $runs,
        DeliveryNoteImportService $service
    ) {
        try {
            $run = $runs->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
            $this->authorize('update', $run);
            $import = DeliveryNoteImport::where('uuid', $import_uuid)->firstOrFail();
            $result = $service->confirm($run, $import, $request->validated());

            return ApiResponse::success([
                'run' => new RunResource($result['run']),
                'shipment_ids' => $result['shipments']->pluck('uuid')->values()->all(),
                'already_confirmed' => $result['already_confirmed'],
            ]);
        } catch (Throwable $exception) {
            Log::error('Delivery note confirmation failed', ['run_id' => $run_uuid, 'import_id' => $import_uuid, 'error' => $exception->getMessage()]);

            return $this->apiError($exception, 'DELIVERY_NOTE_CONFIRMATION_FAILED', 'Unable to create shipments from delivery note.');
        }
    }

    public function download(
        string $run_uuid,
        string $import_uuid,
        Request $request,
        RunService $runs,
        DeliveryNoteImportService $service
    ) {
        $run = $runs->getRunForUser($request->user(), $run_uuid, $request->attributes->get('merchant_environment'));
        $this->authorize('view', $run);
        $import = DeliveryNoteImport::where('uuid', $import_uuid)->where('run_id', $run->id)->firstOrFail();
        $payload = $service->downloadPayload($import);

        return $payload['type'] === 'redirect'
            ? redirect()->away($payload['url'])
            : response()->download(Storage::disk($payload['disk'])->path($payload['path']), $payload['name'], ['Content-Type' => $payload['mime_type']]);
    }
}
