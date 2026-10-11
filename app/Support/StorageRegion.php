<?php

namespace App\Support;

final class StorageRegion
{
    public static function resolve(?string $region, ?string $awsRegion, ?string $endpoint): ?string
    {
        foreach ([$region, $awsRegion] as $configured) {
            if ($configured !== null && trim($configured) !== '') {
                return trim($configured);
            }
        }

        $host = strtolower((string) parse_url($endpoint ?? '', PHP_URL_HOST));
        // R2 requires an SDK region but does not use AWS geographic regions.
        if (str_ends_with($host, '.r2.cloudflarestorage.com')) {
            return 'auto';
        }

        return null;
    }
}
