<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\Run;
use App\Models\RunShipment;
use App\Models\Shipment;
use App\Models\Vehicle;
use App\Models\VehicleActivity;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class VehiclesDailyKpiReportService
{
    private const KPI_KEYS = [
        'speed_violations',
        'runs',
        'shipments',
        'total_stops',
        'unknown_location_stops',
        'invoiced_shipments',
    ];

    public function build(Merchant $merchant, int $year, int $month, bool $onlyWithData): array
    {
        $timezone = $merchant->timezone ?: config('app.timezone', 'UTC');
        $localNow = now($timezone);
        $selectedMonth = Carbon::create($year, $month, 1, 0, 0, 0, $timezone);

        if ($selectedMonth->isAfter($localNow->copy()->startOfMonth())) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'month' => 'The selected month cannot be in the future.',
            ]);
        }

        $from = $selectedMonth->copy()->startOfMonth()->utc();
        $to = $selectedMonth->copy()->addMonth()->startOfMonth()->utc();
        $daysInMonth = $selectedMonth->daysInMonth;

        $vehicles = Vehicle::query()
            ->where('merchant_id', $merchant->id)
            ->orderByRaw('COALESCE(plate_number, ref_code, uuid)')
            ->get(['id', 'uuid', 'plate_number', 'ref_code', 'created_at']);

        $rows = $vehicles->mapWithKeys(function (Vehicle $vehicle) use ($daysInMonth) {
            $days = [];
            for ($day = 1; $day <= $daysInMonth; $day++) {
                $days[(string) $day] = array_fill_keys(self::KPI_KEYS, 0);
            }

            return [$vehicle->id => [
                'vehicle_id' => $vehicle->uuid,
                'registration' => $vehicle->plate_number ?: ($vehicle->ref_code ?: $vehicle->uuid),
                'days' => $days,
            ]];
        })->all();

        $activities = VehicleActivity::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('vehicle_id', $vehicles->pluck('id'))
            ->whereBetween('occurred_at', [$from, $to])
            ->whereIn('event_type', [VehicleActivity::EVENT_SPEEDING, VehicleActivity::EVENT_STOPPED])
            ->get(['vehicle_id', 'event_type', 'occurred_at', 'speed_kph', 'location_id']);

        foreach ($activities as $activity) {
            $day = (string) $activity->occurred_at->copy()->setTimezone($timezone)->day;
            if ($activity->event_type === VehicleActivity::EVENT_SPEEDING && (float) $activity->speed_kph > 80) {
                $rows[$activity->vehicle_id]['days'][$day]['speed_violations']++;
            }
            if ($activity->event_type === VehicleActivity::EVENT_STOPPED) {
                $rows[$activity->vehicle_id]['days'][$day]['total_stops']++;
                if ($activity->location_id === null) {
                    $rows[$activity->vehicle_id]['days'][$day]['unknown_location_stops']++;
                }
            }
        }

        $runs = Run::query()
            ->where('merchant_id', $merchant->id)
            ->whereIn('vehicle_id', $vehicles->pluck('id'))
            ->whereBetween('started_at', [$from, $to])
            ->get(['id', 'vehicle_id', 'started_at']);

        foreach ($runs as $run) {
            $day = (string) $run->started_at->copy()->setTimezone($timezone)->day;
            $rows[$run->vehicle_id]['days'][$day]['runs']++;
        }

        $this->addShipmentCounts($rows, $vehicles->pluck('id'), $merchant->id, $from, $to, $timezone, 'created_at', 'shipments');
        $this->addShipmentCounts($rows, $vehicles->pluck('id'), $merchant->id, $from, $to, $timezone, 'invoiced_at', 'invoiced_shipments');

        $data = array_values($rows);
        if ($onlyWithData) {
            $data = array_values(array_filter($data, function (array $row): bool {
                foreach ($row['days'] as $metrics) {
                    if (array_sum($metrics) > 0) {
                        return true;
                    }
                }

                return false;
            }));
        }

        return [
            'data' => $data,
            'meta' => [
                'year' => $year,
                'month' => $month,
                'month_label' => $selectedMonth->translatedFormat('F Y'),
                'days_in_month' => $daysInMonth,
                'current_local_date' => $localNow->toDateString(),
                'available_years' => $this->availableYears($merchant, $localNow->year),
                'timezone' => $timezone,
            ],
        ];
    }

    private function addShipmentCounts(
        array &$rows,
        Collection $vehicleIds,
        int $merchantId,
        Carbon $from,
        Carbon $to,
        string $timezone,
        string $dateColumn,
        string $metric
    ): void {
        $records = Shipment::query()
            ->join('run_shipments', 'run_shipments.shipment_id', '=', 'shipments.id')
            ->join('runs', 'runs.id', '=', 'run_shipments.run_id')
            ->where('shipments.merchant_id', $merchantId)
            ->whereIn('runs.vehicle_id', $vehicleIds)
            ->where('run_shipments.status', '!=', RunShipment::STATUS_REMOVED)
            ->whereBetween("shipments.{$dateColumn}", [$from, $to])
            ->whereNull('runs.deleted_at')
            ->selectRaw("runs.vehicle_id, shipments.id as shipment_id, shipments.{$dateColumn} as metric_at")
            ->distinct()
            ->get();

        foreach ($records as $record) {
            $day = (string) Carbon::parse($record->metric_at)->setTimezone($timezone)->day;
            $rows[$record->vehicle_id]['days'][$day][$metric]++;
        }
    }

    private function availableYears(Merchant $merchant, int $currentYear): array
    {
        $earliest = collect([
            Vehicle::query()->where('merchant_id', $merchant->id)->min('created_at'),
            VehicleActivity::query()->where('merchant_id', $merchant->id)->min('occurred_at'),
            Run::query()->where('merchant_id', $merchant->id)->min('started_at'),
            Shipment::query()->where('merchant_id', $merchant->id)->min('created_at'),
            Shipment::query()->where('merchant_id', $merchant->id)->min('invoiced_at'),
        ])->filter()->min();
        $firstYear = $earliest ? min(Carbon::parse($earliest)->year, $currentYear) : $currentYear;

        return range($currentYear, $firstYear);
    }
}
