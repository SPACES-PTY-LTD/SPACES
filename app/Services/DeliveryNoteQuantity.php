<?php

namespace App\Services;

/** Shared parcel/measurement semantics for reviewed admin and driver imports. */
class DeliveryNoteQuantity
{
    public const UNITS = ['units', 'boxes', 'pallets', 'drums', 'bags', 'crates', 'rolls', 'liters', 'kilograms', 'tonnes', 'cubic_metres'];
    public const MEASURED = ['liters', 'kilograms', 'tonnes', 'cubic_metres'];

    public static function parcels(array $item): array
    {
        $parcel = array_filter([
            'type' => 'standard', 'contents_description' => $item['description'],
            'weight' => match ($item['quantity_unit'] ?? 'units') {
                'kilograms' => $item['quantity'], 'tonnes' => $item['quantity'] * 1000,
                default => $item['weight'] ?? null,
            },
            'weight_measurement' => 'kg', 'length_cm' => $item['length_cm'] ?? null,
            'width_cm' => $item['width_cm'] ?? null, 'height_cm' => $item['height_cm'] ?? null,
        ], fn ($value) => $value !== null && $value !== '');
        $count = in_array($item['quantity_unit'] ?? 'units', self::MEASURED, true) ? 1 : ($item['quantity'] ?? 1);
        return array_fill(0, (int) $count, $parcel);
    }
}
