<?php

namespace App\Http\Resources\Concerns;

use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

trait FormatsMerchantTimestamps
{
    protected function formatDateForMerchantTimezone(mixed $date, Request $request): ?string
    {
        if (!$date) {
            return null;
        }

        return Carbon::parse($date)
            ->setTimezone($this->resolveMerchantTimezone($request))
            ->toIso8601String();
    }

    protected function resolveMerchantTimezone(Request $request): string
    {
        $timezone = $this->resolveTimezoneFromResource()
            ?? $request->attributes->get('merchant')?->timezone
            ?? $request->attributes->get('merchant_environment')?->merchant?->timezone;

        return is_string($timezone) && $timezone !== '' ? $timezone : 'UTC';
    }

    private function resolveTimezoneFromResource(): ?string
    {
        if (isset($this->resource) && isset($this->resource->timezone) && is_string($this->resource->timezone)) {
            return $this->resource->timezone;
        }

        if (!isset($this->resource) || !method_exists($this->resource, 'relationLoaded')) {
            return null;
        }

        if ($this->resource->relationLoaded('merchant')) {
            return $this->resource->merchant?->timezone;
        }

        if ($this->resource->relationLoaded('shipment')) {
            return $this->resource->shipment?->merchant?->timezone;
        }

        if ($this->resource->relationLoaded('quote')) {
            return $this->resource->quote?->merchant?->timezone;
        }

        return null;
    }
}
