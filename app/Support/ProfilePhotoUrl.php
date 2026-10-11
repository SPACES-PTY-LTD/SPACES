<?php

namespace App\Support;

use Illuminate\Support\Facades\Storage;

class ProfilePhotoUrl
{
    public static function forPath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $disk = Storage::disk();

        // Managed object storage keeps photos private, just like message images.
        return $disk->providesTemporaryUrls()
            ? $disk->temporaryUrl($path, now()->addDay())
            : $disk->url($path);
    }
}
