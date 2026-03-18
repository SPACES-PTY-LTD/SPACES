<?php

namespace App\Services;

use App\Jobs\QuoteRequestJob;
use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Quote;
use App\Models\Shipment;
use App\Models\User;
use App\Services\Carriers\CarrierManager;
use App\Services\Carriers\DTO\ShipmentDTO;
use App\Support\MerchantAccess;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class QuoteService
{
    public function __construct(
        private CarrierManager $carrierManager,
        private LocationService $locationService,
        private ActivityLogService $activityLogService
    )
    {
    }

    public function createQuote(array $data, bool $processNow = false): Quote
    {
        $quote = DB::transaction(function () use ($data, $processNow) {
            $merchantUuid = $data['merchant_id'] ?? $data['merchant_uuid'] ?? null;
            $merchant = Merchant::where('uuid', $merchantUuid)->firstOrFail();

            $environment = null;
            $environmentUuid = $data['environment_id'] ?? $data['environment_uuid'] ?? null;
            if (!empty($environmentUuid)) {
                $environment = MerchantEnvironment::where('uuid', $environmentUuid)
                    ->where('merchant_id', $merchant->id)
                    ->firstOrFail();
            }

            $shipment = null;
            $shipmentUuid = $data['shipment_id'] ?? $data['shipment_uuid'] ?? null;
            if (!empty($shipmentUuid)) {
                $shipment = Shipment::where('uuid', $shipmentUuid)
                    ->where('merchant_id', $merchant->id)
                    ->firstOrFail();
            }

            if ($shipment && $environment && $shipment->environment_id && $shipment->environment_id !== $environment->id) {
                throw ValidationException::withMessages([
                    'environment_id' => ['Environment does not match the shipment.'],
                ]);
            }

            if (!$shipment) {
                $pickupLocation = $this->locationService->storeFromAddress(
                    $data['pickup_address'],
                    $merchant,
                    $environment,
                    'pickup'
                );
                $dropoffLocation = $this->locationService->storeFromAddress(
                    $data['dropoff_address'],
                    $merchant,
                    $environment,
                    'dropoff'
                );

                $shipment = Shipment::create([
                    'account_id' => $merchant->account_id,
                    'merchant_id' => $merchant->id,
                    'environment_id' => $environment?->id,
                    'merchant_order_ref' => $data['merchant_order_ref'] ?? ('TMP-'.now()->timestamp),
                    'status' => 'draft',
                    'pickup_location_id' => $pickupLocation->id,
                    'dropoff_location_id' => $dropoffLocation->id,
                    'collection_date' => $data['collection_date'] ?? null,
                    'metadata' => $data['metadata'] ?? null,
                ]);

                foreach ($data['parcels'] as $parcel) {
                    $shipment->parcels()->create($parcel + [
                        'account_id' => $merchant->account_id,
                    ]);
                }
            } elseif ($environment && !$shipment->environment_id) {
                $shipment->environment_id = $environment->id;
                $shipment->save();
            }

            $quote = Quote::create([
                'account_id' => $merchant->account_id,
                'merchant_order_ref' => $shipment->merchant_order_ref,
                'merchant_id' => $merchant->id,
                'environment_id' => $shipment->environment_id ?? $environment?->id,
                'shipment_id' => $shipment->id,
                'status' => 'created',
                'requested_at' => now(),
                'collection_date' => $data['collection_date'] ?? $shipment->collection_date,
                'expires_at' => now()->addHours(12),
            ]);

            if ($processNow) {
                // Process after commit to avoid holding the transaction open.
            } else {
                QuoteRequestJob::dispatch($quote->id);
            }

            return $quote;
        });

        if ($processNow) {
            $this->processQuoteOptions($quote->fresh());
        }

        $quote->refresh();
        $this->activityLogService->log(
            action: 'created',
            entityType: 'quote',
            entity: $quote,
            accountId: $quote->account_id,
            merchantId: $quote->merchant_id,
            environmentId: $quote->environment_id,
            title: 'Quote created',
            changes: $this->activityLogService->diffChanges([], [
                'status' => $quote->status,
                'shipment_id' => $quote->shipment?->uuid ?? null,
                'collection_date' => $quote->collection_date,
                'expires_at' => $quote->expires_at,
            ])
        );

        return $quote;
    }

    public function getQuoteByUuid(string $uuid): Quote
    {
        return Quote::with('options', 'shipment', 'merchant', 'booking.quoteOption')->where('uuid', $uuid)->firstOrFail();
    }

    public function listQuotes(User $user, array $filters): LengthAwarePaginator
    {
        $query = Quote::query()->with(['shipment', 'merchant', 'environment', 'options', 'booking.quoteOption']);
        $sortableColumns = [
            'created_at' => 'created_at',
            'merchant_order_ref' => 'merchant_order_ref',
            'collection_date' => 'collection_date',
            'status' => 'status',
            'expires_at' => 'expires_at',
            'requested_at' => 'requested_at',
        ];
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';

        if ($user->role !== 'super_admin') {
            MerchantAccess::scopeToMerchants($query, $user);
        } elseif (!empty($filters['with_trashed'])) {
            $query->withTrashed();
        }

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if (!empty($merchantUuid)) {
            $merchant = Merchant::where('uuid', $merchantUuid)->first();
            if ($merchant) {
                $query->where('merchant_id', $merchant->id);
            }
        }

        $environmentUuid = $filters['environment_uuid'] ?? $filters['environment_id'] ?? null;
        if (!empty($environmentUuid)) {
            $environmentId = MerchantEnvironment::where('uuid', $environmentUuid)->value('id');
            if ($environmentId) {
                $query->where('environment_id', $environmentId);
            }
        }

        $shipmentUuid = $filters['shipment_uuid'] ?? $filters['shipment_id'] ?? null;
        if (!empty($shipmentUuid)) {
            $shipmentId = Shipment::where('uuid', $shipmentUuid)->value('id');
            if ($shipmentId) {
                $query->where('shipment_id', $shipmentId);
            }
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['from'])) {
            $query->whereDate('created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('created_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);

        return $query
            ->orderBy($sortColumn, $sortDirection)
            ->orderBy('id')
            ->paginate($perPage);
    }

    public function listShipmentQuotes(Shipment $shipment, int $perPage = 15): LengthAwarePaginator
    {
        return Quote::where('shipment_id', $shipment->id)
            ->orderByDesc('created_at')
            ->paginate(min($perPage, 100));
    }

    private function processQuoteOptions(Quote $quote): void
    {
        $quote->loadMissing(['shipment.parcels', 'shipment.pickupLocation', 'shipment.dropoffLocation', 'merchant']);

        $shipment = $quote->shipment;
        $dto = new ShipmentDTO([
            'shipment_uuid' => $shipment->uuid,
            'merchant_uuid' => $quote->merchant->uuid,
            'pickup_address' => $shipment->pickupAddressArray(),
            'dropoff_address' => $shipment->dropoffAddressArray(),
            'parcels' => $shipment->parcels->toArray(),
            'collection_date' => optional($shipment->collection_date)?->toIso8601String(),
            'metadata' => $shipment->metadata,
        ]);

        $adapter = $this->carrierManager->adapter(config('carriers.default', 'internal'));
        $options = $adapter->quote($dto);

        foreach ($options->options as $option) {
            $quote->options()->create([
                'account_id' => $quote->account_id,
                'carrier_code' => $option->carrierCode,
                'service_code' => $option->serviceCode,
                'currency' => $option->currency,
                'amount' => $option->amount,
                'tax_amount' => $option->taxAmount,
                'total_amount' => $option->totalAmount,
                'eta_from' => $option->etaFrom,
                'eta_to' => $option->etaTo,
                'rules' => $option->rules,
            ]);
        }
    }
}
