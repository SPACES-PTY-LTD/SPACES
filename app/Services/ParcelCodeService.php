<?php

namespace App\Services;

use App\Models\ShipmentParcel;

class ParcelCodeService
{
    private const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    private const DEFAULT_LENGTH = 10;

    public function generateUniqueCode(int $length = self::DEFAULT_LENGTH): string
    {
        do {
            $code = $this->randomCode($length);
        } while (ShipmentParcel::withTrashed()->where('parcel_code', $code)->exists());

        return $code;
    }

    public function backfillMissingCodes(): array
    {
        $summary = [
            'processed' => 0,
            'updated' => 0,
        ];

        ShipmentParcel::withTrashed()
            ->whereNull('parcel_code')
            ->orderBy('id')
            ->chunkById(100, function ($parcels) use (&$summary) {
                foreach ($parcels as $parcel) {
                    $summary['processed']++;
                    $parcel->forceFill([
                        'parcel_code' => $this->generateUniqueCode(),
                    ])->save();
                    $summary['updated']++;
                }
            });

        return $summary;
    }

    private function randomCode(int $length): string
    {
        $maxIndex = strlen(self::ALPHABET) - 1;
        $code = '';

        for ($index = 0; $index < $length; $index++) {
            $code .= self::ALPHABET[random_int(0, $maxIndex)];
        }

        return $code;
    }
}
