<?php

namespace App\Services;

use App\Models\DeliveryNoteImport;
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
        if (! $run->isMutable()) {
            throw new ConflictHttpException('Delivery notes can only be imported while the run is draft or dispatched.');
        }

        $disk = (string) config('filesystems.default', 'local');
        $extension = $file->getClientOriginalExtension();
        $filename = (string) Str::uuid().($extension ? '.'.$extension : '');
        $path = "delivery-note-imports/{$run->merchant->uuid}/{$run->uuid}/{$filename}";

        Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path), ['visibility' => 'private']);

        $import = DeliveryNoteImport::create([
            'account_id' => $run->account_id,
            'merchant_id' => $run->merchant_id,
            'environment_id' => $run->environment_id,
            'run_id' => $run->id,
            'uploaded_by_user_id' => $user->id,
            'status' => DeliveryNoteImport::STATUS_ANALYZED,
            'disk' => $disk,
            'path' => $path,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => (string) $file->getMimeType(),
            'size_bytes' => (int) $file->getSize(),
        ]);

        try {
            $result = $this->openAI->extractDeliveryNote($file);
            $import->update([
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

    public function confirm(Run $run, DeliveryNoteImport $import, array $data): array
    {
        if (! $run->isMutable()) {
            throw new ConflictHttpException('Delivery notes can only be confirmed while the run is draft or dispatched.');
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

            $refreshedRun = $this->runService->attachShipments($run, $shipments->pluck('uuid')->all());
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
            'pickup_address' => $data['pickup_address'],
            'dropoff_address' => $data['dropoff_address'],
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
            'type' => $item['type'] ?? null,
            'weight' => $item['weight'] ?? null,
            'weight_measurement' => 'kg',
            'length_cm' => $item['length_cm'] ?? null,
            'width_cm' => $item['width_cm'] ?? null,
            'height_cm' => $item['height_cm'] ?? null,
            'contents_description' => $item['description'],
        ], fn ($value) => $value !== null && $value !== '');
    }
}
