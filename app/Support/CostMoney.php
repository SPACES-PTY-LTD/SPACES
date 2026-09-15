<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

class CostMoney
{
    // Supported currencies and their minor-unit precision, shared with the website selector.
    public const CURRENCIES = ['ZAR' => 2, 'USD' => 2, 'EUR' => 2, 'GBP' => 2, 'BWP' => 2, 'NAD' => 2, 'SZL' => 2, 'LSL' => 2, 'MZN' => 2, 'ZMW' => 2, 'KES' => 2, 'TZS' => 2, 'UGX' => 0, 'NGN' => 2, 'GHS' => 2, 'AED' => 2, 'AUD' => 2, 'CAD' => 2, 'CHF' => 2, 'CNY' => 2, 'INR' => 2, 'JPY' => 0, 'KWD' => 3];

    public static function validateAmount(mixed $amount, string $currency): string
    {
        $precision = self::CURRENCIES[$currency] ?? null;
        if ($precision === null || ! is_string($amount) || ! preg_match('/^(0|[1-9][0-9]{0,9})(\.[0-9]{1,4})?$/D', $amount)) {
            throw ValidationException::withMessages(['amount' => 'Enter a nonnegative decimal amount (up to 10 whole digits) as a string.']);
        }
        $fraction = explode('.', $amount)[1] ?? '';
        if (strlen($fraction) > $precision) {
            throw ValidationException::withMessages(['amount' => "{$currency} supports {$precision} decimal places."]);
        }

        return self::format(self::units($amount), $currency);
    }

    public static function units(string $amount): int
    {
        [$whole, $fraction] = array_pad(explode('.', $amount), 2, '');

        return ((int) $whole * 10000) + (int) str_pad($fraction, 4, '0');
    }

    public static function format(int $units, string $currency): string
    {
        $precision = self::CURRENCIES[$currency] ?? 2;

        return (string) intdiv($units, 10000).($precision ? '.'.substr(str_pad((string) ($units % 10000), 4, '0', STR_PAD_LEFT), 0, $precision) : '');
    }

    public static function totals(iterable $costs): array
    {
        $totals = [];
        foreach ($costs as $cost) {
            $totals[$cost->currency] = ($totals[$cost->currency] ?? 0) + self::units($cost->amount);
        }
        ksort($totals);

        return collect($totals)->map(fn ($amount, $currency) => ['currency' => $currency, 'amount' => self::format($amount, $currency)])->values()->all();
    }
}
