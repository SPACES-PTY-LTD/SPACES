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
use Illuminate\Validation\ValidationException;

class VehiclesDailyKpiReportService
{
    private const KPI_LABELS = [
        'speed_violations' => 'Speed Violation > 80km/hr (Over Speed)',
        'runs' => 'Runs',
        'shipments' => 'Shipments',
        'known_location_stops' => 'Stops at Known Locations',
        'unknown_location_stops' => 'Stops at Unknown Locations',
        'invoiced_shipments' => 'Invoiced Shipments',
    ];

    private const KPI_KEYS = [
        'speed_violations',
        'runs',
        'shipments',
        'known_location_stops',
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
            ->whereIn('event_type', [
                VehicleActivity::EVENT_SPEEDING,
                VehicleActivity::EVENT_STOPPED,
                VehicleActivity::EVENT_ENTERED_LOCATION,
            ])
            ->get(['vehicle_id', 'event_type', 'occurred_at', 'speed_kph', 'location_id']);

        foreach ($activities as $activity) {
            $day = (string) $activity->occurred_at->copy()->setTimezone($timezone)->day;
            if ($activity->event_type === VehicleActivity::EVENT_SPEEDING && (float) $activity->speed_kph > 80) {
                $rows[$activity->vehicle_id]['days'][$day]['speed_violations']++;
            }
            if ($activity->event_type === VehicleActivity::EVENT_ENTERED_LOCATION && $activity->location_id !== null) {
                $rows[$activity->vehicle_id]['days'][$day]['known_location_stops']++;
            }
            if ($activity->event_type === VehicleActivity::EVENT_STOPPED && $activity->location_id === null) {
                $rows[$activity->vehicle_id]['days'][$day]['unknown_location_stops']++;
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

    public function entries(
        Merchant $merchant,
        Vehicle $vehicle,
        int $year,
        int $month,
        int $day,
        string $metric,
        int $perPage = 25
    ): array {
        [$selectedDate, $from, $to, $timezone] = $this->dayRange($merchant, $year, $month, $day);

        if (in_array($metric, ['speed_violations', 'known_location_stops', 'unknown_location_stops'], true)) {
            $query = VehicleActivity::query()
                ->with(['location', 'run.driver.user', 'shipment'])
                ->where('merchant_id', $merchant->id)
                ->where('vehicle_id', $vehicle->id)
                ->whereBetween('occurred_at', [$from, $to])
                ->when($metric === 'speed_violations', fn ($builder) => $builder
                    ->where('event_type', VehicleActivity::EVENT_SPEEDING)
                    ->where('speed_kph', '>', 80))
                ->when($metric === 'known_location_stops', fn ($builder) => $builder
                    ->where('event_type', VehicleActivity::EVENT_ENTERED_LOCATION)
                    ->whereNotNull('location_id'))
                ->when($metric === 'unknown_location_stops', fn ($builder) => $builder
                    ->where('event_type', VehicleActivity::EVENT_STOPPED))
                ->when($metric === 'unknown_location_stops', fn ($builder) => $builder->whereNull('location_id'))
                ->orderBy('occurred_at');
            $paginator = $query->paginate($perPage);
            $data = $paginator->getCollection()->map(fn (VehicleActivity $activity) => [
                'entry_type' => 'activity',
                'entry_id' => $activity->uuid,
                'reference' => $activity->uuid,
                'occurred_at' => $activity->occurred_at?->toIso8601String(),
                'status' => $activity->event_type,
                'speed_kph' => $activity->speed_kph !== null ? (float) $activity->speed_kph : null,
                'speed_limit_kph' => $activity->speed_limit_kph !== null ? (float) $activity->speed_limit_kph : null,
                'location' => $activity->location?->name ?? $activity->location?->code,
                'run_id' => $activity->run?->uuid,
                'shipment_id' => $activity->shipment?->uuid,
                'shipment_reference' => $activity->shipment?->merchant_order_ref,
            ])->values()->all();
        } elseif ($metric === 'runs') {
            $paginator = Run::query()
                ->with('driver.user')
                ->withCount(['runShipments' => fn ($builder) => $builder->where('status', '!=', RunShipment::STATUS_REMOVED)])
                ->where('merchant_id', $merchant->id)
                ->where('vehicle_id', $vehicle->id)
                ->whereBetween('started_at', [$from, $to])
                ->orderBy('started_at')
                ->paginate($perPage);
            $data = $paginator->getCollection()->map(fn (Run $run) => [
                'entry_type' => 'run',
                'entry_id' => $run->uuid,
                'reference' => $run->uuid,
                'occurred_at' => $run->started_at?->toIso8601String(),
                'status' => $run->status,
                'driver' => $run->driver?->user?->name ?? $run->driver?->user?->email,
                'shipment_count' => (int) $run->run_shipments_count,
            ])->values()->all();
        } else {
            $dateColumn = $metric === 'invoiced_shipments' ? 'invoiced_at' : 'created_at';
            $paginator = Shipment::query()
                ->with(['runShipments' => fn ($builder) => $builder
                    ->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('run', fn ($runQuery) => $runQuery
                        ->where('vehicle_id', $vehicle->id)
                        ->whereNull('deleted_at'))
                    ->with('run')])
                ->where('merchant_id', $merchant->id)
                ->whereBetween($dateColumn, [$from, $to])
                ->whereHas('runShipments', fn ($builder) => $builder
                    ->where('status', '!=', RunShipment::STATUS_REMOVED)
                    ->whereHas('run', fn ($runQuery) => $runQuery
                        ->where('vehicle_id', $vehicle->id)
                        ->whereNull('deleted_at')))
                ->orderBy($dateColumn)
                ->paginate($perPage);
            $data = $paginator->getCollection()->map(function (Shipment $shipment) use ($dateColumn) {
                $run = $shipment->runShipments->first()?->run;

                return [
                    'entry_type' => 'shipment',
                    'entry_id' => $shipment->uuid,
                    'reference' => $shipment->merchant_order_ref ?: $shipment->uuid,
                    'occurred_at' => $shipment->{$dateColumn}?->toIso8601String(),
                    'status' => $shipment->status,
                    'invoice_number' => $shipment->invoice_number,
                    'run_id' => $run?->uuid,
                ];
            })->values()->all();
        }

        return [
            'data' => $data,
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'vehicle_id' => $vehicle->uuid,
                'registration' => $vehicle->plate_number ?: ($vehicle->ref_code ?: $vehicle->uuid),
                'date' => $selectedDate->toDateString(),
                'date_label' => $selectedDate->translatedFormat('j F Y'),
                'metric' => $metric,
                'metric_label' => self::KPI_LABELS[$metric],
                'timezone' => $timezone,
            ],
        ];
    }

    private function dayRange(Merchant $merchant, int $year, int $month, int $day): array
    {
        $timezone = $merchant->timezone ?: config('app.timezone', 'UTC');
        try {
            $selectedDate = Carbon::createSafe($year, $month, $day, 0, 0, 0, $timezone);
        } catch (\Throwable) {
            throw ValidationException::withMessages(['day' => 'The selected date is invalid.']);
        }

        if ($selectedDate->isAfter(now($timezone)->startOfDay())) {
            throw ValidationException::withMessages(['day' => 'The selected date cannot be in the future.']);
        }

        return [$selectedDate, $selectedDate->copy()->utc(), $selectedDate->copy()->addDay()->utc(), $timezone];
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
