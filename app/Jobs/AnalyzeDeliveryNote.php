<?php

namespace App\Jobs;

use App\Models\DeliveryNoteImport;
use App\Services\DeliveryNoteImportService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

class AnalyzeDeliveryNote implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;
    public int $timeout = 300;
    public bool $failOnTimeout = true;

    public function __construct(public int $importId)
    {
        $this->onConnection('document-imports');
        $this->onQueue('document-imports');
    }

    public function handle(DeliveryNoteImportService $service): void
    {
        // Claim once. Duplicate deliveries must not repeat extraction or overwrite review edits.
        if (!DeliveryNoteImport::whereKey($this->importId)->where('status', 'queued')->update(['status' => 'processing'])) return;
        $import = DeliveryNoteImport::findOrFail($this->importId);
        $temporary = tmpfile();
        $source = null;
        try {
            if ($temporary === false) throw new \RuntimeException('Unable to prepare the document for analysis.');
            $source = Storage::disk($import->disk)->readStream($import->path);
            if ($source === false || stream_copy_to_stream($source, $temporary) === false) {
                throw new \RuntimeException('Unable to read the uploaded document.');
            }
            $file = new UploadedFile(stream_get_meta_data($temporary)['uri'], $import->original_name, $import->mime_type, null, true);
            $service->extractDocument($import, $file);
        } catch (Throwable $exception) {
            $this->failed($exception);
            throw $exception;
        } finally {
            if (is_resource($source)) fclose($source);
            if (is_resource($temporary)) fclose($temporary);
        }
    }

    public function failed(?Throwable $exception): void
    {
        DeliveryNoteImport::whereKey($this->importId)->whereIn('status', ['queued', 'processing'])->update([
            'status' => 'failed',
            'failure_message' => Str::limit($exception?->getMessage() ?: 'Document processing stopped. Please upload it again.', 4000),
        ]);
    }
}
