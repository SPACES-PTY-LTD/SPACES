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
            ->groupBy('disk')
            ->each(function ($files, string $disk): void {
                $paths = $files
                    ->pluck('path')
                    ->filter(fn ($path) => is_string($path) && $path !== '')
                    ->unique()
                    ->values()
                    ->all();

                if ($paths !== []) {
                    Storage::disk($disk)->delete($paths);
                }
            });
    }
}
