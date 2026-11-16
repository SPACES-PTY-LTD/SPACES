<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Storage;

class DeleteMerchantFilesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public array $files) {}

    public function backoff(): array
    {
        return [10, 60, 300];
    }

    public function handle(): void
    {
        collect($this->files)
            ->filter(function (array $file): bool {
                foreach (['entity_files', 'delivery_note_imports'] as $table) {
                    if (\Illuminate\Support\Facades\DB::table($table)->where('disk', $file['disk'])->where('path', $file['path'])->exists()) {
                        return false;
                    }
                }

                return true;
            })
            ->groupBy('disk')
            ->each(function ($files, string $disk): void {
                $paths = $files
                    ->pluck('path')
                    ->filter(fn ($path) => is_string($path) && $path !== '')
                    ->unique()
                    ->values()
                    ->all();

                if ($paths !== []) {
                    if (Storage::disk($disk)->delete($paths) === false) {
                        throw new \RuntimeException('Unable to delete merchant files from disk '.$disk);
                    }
                }
            });
    }
}
