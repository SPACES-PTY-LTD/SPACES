<?php

namespace App\Services;

use App\Models\DeliveryNoteImport;
use App\Models\Merchant;
use App\Models\Run;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Integrations\OpenAIService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class DeliveryNoteImportService
{
    public function __construct(
        private OpenAIService $openAI,
        private ShipmentService $shipmentService,
        private RunService $runService,
    ) {}

    public function analyze(Run $run, User $user, UploadedFile $file): DeliveryNoteImport
    {
        if (! $this->canImportInto($run)) {
            throw new ConflictHttpException('Delivery notes can only be imported while the run is draft, dispatched, or in progress.');
        }

        return $this->analyzeDocument($user, $file, $run->merchant, $run);
    }

    public function analyzeDocument(User $user, UploadedFile $file, Merchant $merchant, ?Run $run = null): DeliveryNoteImport
    {
        $import = $this->storeDocument($user, $file, $merchant, $run);
        return $this->extractDocument($import, $file);
    }

    public function queueDocument(User $user, UploadedFile $file, Merchant $merchant, ?Run $run, string $uuid, ?int $environmentId = null): DeliveryNoteImport
    {
        $existing = DeliveryNoteImport::where('uuid', $uuid)->first();
        if ($existing) {
            abort_unless($existing->uploaded_by_user_id === $user->id && $existing->merchant_id === $merchant->id && $existing->account_id === $merchant->account_id, 404);
            abort_unless((int) $existing->run_id === (int) $run?->id
                && (int) $existing->environment_id === (int) ($run?->environment_id ?? $environmentId), 409, 'This import ID belongs to a different run or environment.');
            return $existing;
        }
        try {
            $import = $this->storeDocument($user, $file, $merchant, $run, $uuid, $environmentId);
        } catch (\Illuminate\Database\QueryException $exception) {
            $existing = DeliveryNoteImport::where('uuid', $uuid)->where('uploaded_by_user_id', $user->id)
                ->where('merchant_id', $merchant->id)->where('account_id', $merchant->account_id)->first();
            if ($existing) return $this->queueDocument($user, $file, $merchant, $run, $uuid, $environmentId);
            throw $exception;
        }
        try {
            \App\Jobs\AnalyzeDeliveryNote::dispatch($import->id);
        } catch (\Throwable $exception) {
            $import->update(['status' => DeliveryNoteImport::STATUS_FAILED, 'failure_message' => 'Document processing could not be queued. Please upload it again.']);
            throw $exception;
        }
        return $import;
    }

    private function storeDocument(User $user, UploadedFile $file, Merchant $merchant, ?Run $run, ?string $uuid = null, ?int $environmentId = null): DeliveryNoteImport
    {

        $disk = (string) config('filesystems.default', 'local');
        $extension = $file->getClientOriginalExtension();
        $filename = (string) Str::uuid().($extension ? '.'.$extension : '');
        $scope = $run?->uuid ?? ($uuid ? 'analysis' : 'driver-documents');
        $path = "delivery-note-imports/{$merchant->uuid}/{$scope}/{$filename}";

        if (Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path), ['visibility' => 'private']) === false) {
            throw new \RuntimeException('Unable to save the delivery note. Please try again.');
        }

        try {
            $import = DeliveryNoteImport::create([
                'account_id' => $merchant->account_id,
                'merchant_id' => $merchant->id,
                'environment_id' => $run?->environment_id ?? $environmentId,
                'run_id' => $run?->id,
                'uploaded_by_user_id' => $user->id,
                'uuid' => $uuid ?? (string) Str::uuid(),
                'status' => $uuid ? DeliveryNoteImport::STATUS_QUEUED : DeliveryNoteImport::STATUS_PROCESSING,
                'disk' => $disk,
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => (string) $file->getMimeType(),
                'size_bytes' => (int) $file->getSize(),
            ]);

        } catch (\Throwable $exception) {
            Storage::disk($disk)->delete($path);
            throw $exception;
        }
        return $import;
    }

    public function extractDocument(DeliveryNoteImport $import, UploadedFile $file): DeliveryNoteImport
    {
        try {
            $result = $this->openAI->extractDeliveryNote($file);
            $import->update([
                'status' => DeliveryNoteImport::STATUS_ANALYZED,
                'failure_message' => null,
                'model' => $result['model'],
                'extracted_data' => $result['data'],
            ]);
        } catch (\Throwable $exception) {
            $import->update([
                'status' => DeliveryNoteImport::STATUS_FAILED,
                'failure_message' => Str::limit($exception->getMessage(), 4000),
            ]);
            throw $exception;
        }

        return $import->fresh(['run', 'shipments']);
    }

    public function processingPayload(DeliveryNoteImport $import): array
    {
        if (in_array($import->status, ['queued', 'processing'], true) && $import->updated_at->lt(now()->subMinutes(15))) {
            DeliveryNoteImport::whereKey($import->id)->whereIn('status', ['queued', 'processing'])
                ->where('updated_at', '<', now()->subMinutes(15))->update([
                    'status' => 'failed', 'failure_message' => 'Document processing timed out. Please upload the document again.',
                ]);
            $import->refresh();
        }
        $refs = collect($import->extracted_data['line_items'] ?? [])->pluck('merchant_order_ref')
            ->push($import->extracted_data['merchant_order_ref'] ?? null)->filter();

        return [
            'import_id' => $import->uuid, 'status' => $import->status, 'filename' => $import->original_name,
            'failure_message' => $import->failure_message, 'poll_after_ms' => 3200,
            'run_id' => $import->run?->uuid, 'extracted_data' => $import->extracted_data,
            'confirmation_result' => $import->confirmation_result,
            'existing_references' => Shipment::withTrashed()->where('merchant_id', $import->merchant_id)->where('account_id', $import->account_id)
                ->when($import->environment_id, fn ($query) => $query->where('environment_id', $import->environment_id))
                ->whereIn('merchant_order_ref', $refs)->pluck('merchant_order_ref')->all(),
        ];
    }

    public function confirm(Run $run, DeliveryNoteImport $import, array $data): array
    {
        if (! $this->canImportInto($run)) {
            throw new ConflictHttpException('Delivery notes can only be confirmed while the run is draft, dispatched, or in progress.');
        }
        if ($import->run_id !== $run->id) {
            abort(404);
        }
        if ($import->status === DeliveryNoteImport::STATUS_CONFIRMED) {
            return [
                'run' => $this->runService->getRunForUser(request()->user(), $run->uuid, request()->attributes->get('merchant_environment')),
                'shipments' => $import->shipments()->get(),
                'already_confirmed' => true,
            ];
        }
        if ($import->status !== DeliveryNoteImport::STATUS_ANALYZED) {
            throw new ConflictHttpException('Only successfully analyzed delivery notes can be confirmed.');
        }

        $payloads = $this->shipmentPayloads($run, $import, $data);
        $references = collect($payloads)->pluck('merchant_order_ref');
        if ($references->duplicates()->isNotEmpty()) {
            throw ValidationException::withMessages(['line_items' => ['Shipment references must be unique.']]);
        }
        $existing = Shipment::query()
            ->where('merchant_id', $run->merchant_id)
            ->whereIn('merchant_order_ref', $references)
            ->pluck('merchant_order_ref')
            ->all();
        if ($existing !== []) {
            throw ValidationException::withMessages([
                'line_items' => ['Shipment reference already exists: '.implode(', ', $existing)],
            ]);
        }

        return DB::transaction(function () use ($run, $import, $payloads) {
            $shipments = collect($payloads)->map(function (array $payload) {
                $result = $this->shipmentService->createShipment($payload);

                return $result['shipment'];
            });

            $refreshedRun = $this->runService->attachShipments(
                $run,
                $shipments->pluck('uuid')->all(),
                allowInProgress: true
            );
            $import->shipments()->sync($shipments->pluck('id')->all());
            $import->update([
                'status' => DeliveryNoteImport::STATUS_CONFIRMED,
                'confirmed_at' => now(),
            ]);

            return [
                'run' => $refreshedRun,
                'shipments' => $shipments,
                'already_confirmed' => false,
            ];
        });
    }

    public function downloadPayload(DeliveryNoteImport $import): array
    {
        $disk = Storage::disk($import->disk);
        if (method_exists($disk, 'providesTemporaryUrls') && $disk->providesTemporaryUrls()) {
            return ['type' => 'redirect', 'url' => $disk->temporaryUrl($import->path, now()->addMinutes(5))];
        }

        abort_unless($disk->exists($import->path), 404);

        return [
            'type' => 'download', 'disk' => $import->disk, 'path' => $import->path,
            'name' => $import->original_name, 'mime_type' => $import->mime_type,
        ];
    }

    private function shipmentPayloads(Run $run, DeliveryNoteImport $import, array $data): array
    {
        $base = [
            'merchant_id' => $run->merchant->uuid,
            'environment_id' => $run->environment?->uuid,
            'delivery_note_number' => $data['delivery_note_number'] ?? null,
            'collection_date' => $data['collection_date'],
            'pickup_location_id' => $data['pickup_location_id'] ?? null,
            'dropoff_location_id' => $data['dropoff_location_id'] ?? null,
            'pickup_address' => $data['pickup_address'] ?? null,
            'dropoff_address' => $data['dropoff_address'] ?? null,
            'pickup_instructions' => $data['pickup_instructions'] ?? null,
            'dropoff_instructions' => $data['dropoff_instructions'] ?? null,
            'auto_assign' => false,
            'metadata' => ['delivery_note_import_id' => $import->uuid],
        ];

        if ($data['grouping_mode'] === 'single_shipment') {
            return [[
                ...$base,
                'merchant_order_ref' => $data['merchant_order_ref'],
                'parcels' => collect($data['line_items'])->map(fn (array $item) => $this->parcel($item))->all(),
            ]];
        }

        return collect($data['line_items'])->map(fn (array $item) => [
            ...$base,
            'merchant_order_ref' => $item['merchant_order_ref'],
            'parcels' => [$this->parcel($item)],
        ])->all();
    }

    private function parcel(array $item): array
    {
        return array_filter([
            'type' => 'standard',
            'weight' => $item['weight'] ?? null,
            'weight_measurement' => 'kg',
            'length_cm' => $item['length_cm'] ?? null,
            'width_cm' => $item['width_cm'] ?? null,
            'height_cm' => $item['height_cm'] ?? null,
            'contents_description' => $item['description'],
        ], fn ($value) => $value !== null && $value !== '');
    }

    private function canImportInto(Run $run): bool
    {
        return in_array($run->status, [
            Run::STATUS_DRAFT,
            Run::STATUS_DISPATCHED,
            Run::STATUS_IN_PROGRESS,
        ], true);
    }
}
