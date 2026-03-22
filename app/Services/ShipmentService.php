<?php

namespace App\Services;

use App\Models\Merchant;
use App\Models\MerchantEnvironment;
use App\Models\Shipment;
use App\Models\User;
use App\Models\VehicleType;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class ShipmentService
{
    public function __construct(
        private LocationService $locationService,
        private DeliveryOfferService $deliveryOfferService,
        private ShipmentParcelService $shipmentParcelService,
    )
    {
    }

    public function createShipment(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $merchantUuid = $data['merchant_id'] ?? $data['merchant_uuid'] ?? null;
            $merchant = Merchant::where('uuid', $merchantUuid)->firstOrFail();
            $environmentId = null;
            $environment = null;
            $environmentUuid = $data['environment_id'] ?? $data['environment_uuid'] ?? null;
            if (!empty($environmentUuid)) {
                $environment = MerchantEnvironment::where('uuid', $environmentUuid)
                    ->where('merchant_id', $merchant->id)
                    ->firstOrFail();
                $environmentId = $environment->id;
            }

            $existingShipment = Shipment::withTrashed()
                ->where('merchant_id', $merchant->id)
                ->where('merchant_order_ref', $data['merchant_order_ref'])
                ->first();

            if ($existingShipment) {
                return [
                    'shipment' => $existingShipment,
                    'created' => false,
                    'message' => 'Shipment already exists for this merchant_order_ref. Returning existing shipment.',
                ];
            }

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
                'environment_id' => $environmentId,
                'merchant_order_ref' => $data['merchant_order_ref'],
                'delivery_note_number' => $data['delivery_note_number'] ?? null,
                'invoice_number' => $data['invoice_number'] ?? null,
                'invoiced_at' => $this->resolveInvoicedAtForWrite($data),
                'status' => 'draft',
                'pickup_location_id' => $pickupLocation->id,
                'dropoff_location_id' => $dropoffLocation->id,
                'requested_vehicle_type_id' => $this->resolveVehicleTypeId(
                    $data['requested_vehicle_type_id'] ?? null,
                    $data['requested_vehicle_type'] ?? null
                ),
                'pickup_instructions' => $data['pickup_instructions'] ?? null,
                'dropoff_instructions' => $data['dropoff_instructions'] ?? null,
                'ready_at' => $data['ready_at'] ?? null,
                'collection_date' => $data['collection_date'] ?? null,
                'service_type' => $data['service_type'] ?? null,
                'priority' => $data['priority'] ?? 'normal',
                'auto_assign' => array_key_exists('auto_assign', $data) ? (bool) $data['auto_assign'] : true,
                'notes' => $data['notes'] ?? null,
                'metadata' => $data['metadata'] ?? null,
            ]);

            $this->shipmentParcelService->createShipmentParcels($shipment, $data['parcels']);

            if ((bool) $shipment->auto_assign) {
                $this->deliveryOfferService->startOffersForShipment($shipment->load('merchant', 'environment', 'pickupLocation', 'dropoffLocation', 'requestedVehicleType'));
            }

            return [
                'shipment' => $shipment,
                'created' => true,
                'message' => 'Shipment created successfully.',
            ];
        });
    }

    public function listShipments(User $user, array $filters): LengthAwarePaginator
    {
        $query = Shipment::query()
            ->select('shipments.*')
            ->leftJoin('locations as shipment_pickup_locations', 'shipment_pickup_locations.id', '=', 'shipments.pickup_location_id')
            ->leftJoin('locations as shipment_dropoff_locations', 'shipment_dropoff_locations.id', '=', 'shipments.dropoff_location_id')
            ->with([
                'parcels',
                'merchant',
                'pickupLocation',
                'dropoffLocation',
                'requestedVehicleType',
                'currentRunShipment.run.driver.user',
                'currentRunShipment.run.vehicle.lastDriver.user',
            ]);

        if ($user->role !== 'super_admin') {
            $query->whereHas('merchant.users', function (Builder $builder) use ($user) {
                $builder->where('users.id', $user->id);
            });
        } elseif (!empty($filters['with_trashed'])) {
            $query->withTrashed();
        }

        $merchantUuid = $filters['merchant_uuid'] ?? $filters['merchant_id'] ?? null;
        if (!empty($merchantUuid)) {
            $merchant = Merchant::where('uuid', $merchantUuid)->first();
            if ($merchant) {
                $query->where('shipments.merchant_id', $merchant->id);
            }
        }

        $environmentUuid = $filters['environment_uuid'] ?? $filters['environment_id'] ?? null;
        if (!empty($environmentUuid)) {
            $environmentId = MerchantEnvironment::where('uuid', $environmentUuid)->value('id');
            if ($environmentId) {
                $query->where('shipments.environment_id', $environmentId);
            }
        }

        if (!empty($filters['status'])) {
            $query->where('shipments.status', $filters['status']);
        }

        if (!empty($filters['merchant_order_ref'])) {
            $query->where('shipments.merchant_order_ref', 'like', '%' . $filters['merchant_order_ref'] . '%');
        }

        if (!empty($filters['service_type'])) {
            $query->where('shipments.service_type', $filters['service_type']);
        }

        if (!empty($filters['priority'])) {
            $query->where('shipments.priority', $filters['priority']);
        }

        if (array_key_exists('auto_assign', $filters)) {
            $query->where('shipments.auto_assign', filter_var($filters['auto_assign'], FILTER_VALIDATE_BOOLEAN));
        }

        if (array_key_exists('invoiced', $filters)) {
            $invoiced = filter_var($filters['invoiced'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($invoiced === true) {
                $query->whereNotNull('shipments.invoiced_at');
            } elseif ($invoiced === false) {
                $query->whereNull('shipments.invoiced_at');
            }
        }

        if (!empty($filters['from'])) {
            $query->whereDate('shipments.created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('shipments.created_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);
        $this->applyShipmentListSorting($query, $filters);

        return $query->paginate($perPage);
    }

    public function listShipmentsForEnvironment(MerchantEnvironment $environment, array $filters): LengthAwarePaginator
    {
        $query = Shipment::query()
            ->select('shipments.*')
            ->leftJoin('locations as shipment_pickup_locations', 'shipment_pickup_locations.id', '=', 'shipments.pickup_location_id')
            ->leftJoin('locations as shipment_dropoff_locations', 'shipment_dropoff_locations.id', '=', 'shipments.dropoff_location_id')
            ->with([
                'parcels',
                'merchant',
                'pickupLocation',
                'dropoffLocation',
                'requestedVehicleType',
                'currentRunShipment.run.driver.user',
                'currentRunShipment.run.vehicle.lastDriver.user',
            ])
            ->where('shipments.merchant_id', $environment->merchant_id)
            ->where('shipments.environment_id', $environment->id);

        if (!empty($filters['status'])) {
            $query->where('shipments.status', $filters['status']);
        }

        if (!empty($filters['merchant_order_ref'])) {
            $query->where('shipments.merchant_order_ref', $filters['merchant_order_ref']);
        }

        if (!empty($filters['service_type'])) {
            $query->where('shipments.service_type', $filters['service_type']);
        }

        if (!empty($filters['priority'])) {
            $query->where('shipments.priority', $filters['priority']);
        }

        if (array_key_exists('auto_assign', $filters)) {
            $query->where('shipments.auto_assign', filter_var($filters['auto_assign'], FILTER_VALIDATE_BOOLEAN));
        }

        if (array_key_exists('invoiced', $filters)) {
            $invoiced = filter_var($filters['invoiced'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($invoiced === true) {
                $query->whereNotNull('shipments.invoiced_at');
            } elseif ($invoiced === false) {
                $query->whereNull('shipments.invoiced_at');
            }
        }

        if (!empty($filters['from'])) {
            $query->whereDate('shipments.created_at', '>=', $filters['from']);
        }

        if (!empty($filters['to'])) {
            $query->whereDate('shipments.created_at', '<=', $filters['to']);
        }

        $perPage = min((int) ($filters['per_page'] ?? 15), 100);
        $this->applyShipmentListSorting($query, $filters);

        return $query->paginate($perPage);
    }

    private function applyShipmentListSorting(Builder $query, array $filters): void
    {
        $sortBy = (string) ($filters['sort_by'] ?? 'created_at');
        $sortDirection = strtolower((string) ($filters['sort_direction'] ?? $filters['sort_dir'] ?? 'desc'));
        if (!in_array($sortDirection, ['asc', 'desc'], true)) {
            $sortDirection = 'desc';
        }

        $sortableColumns = [
            'created_at' => 'shipments.created_at',
            'merchant_order_ref' => 'shipments.merchant_order_ref',
            'service_type' => 'shipments.service_type',
            'from' => 'shipment_pickup_locations.name',
            'pickup_location' => 'shipment_pickup_locations.name',
            'to' => 'shipment_dropoff_locations.name',
            'dropoff_location' => 'shipment_dropoff_locations.name',
            'status' => 'shipments.status',
            'collection_date' => 'shipments.collection_date',
            'ready_at' => 'shipments.ready_at',
            'priority' => 'shipments.priority',
        ];

        $sortColumn = $sortableColumns[$sortBy] ?? 'shipments.created_at';

        $query->orderBy($sortColumn, $sortDirection)
            ->orderByDesc('shipments.id');
    }

    public function updateShipment(Shipment $shipment, array $data): Shipment
    {
        return DB::transaction(function () use ($shipment, $data) {
            $shipment->loadMissing(['merchant', 'environment']);
            $beforeInvoiceNumber = $shipment->invoice_number;
            $shipment->fill(Arr::only($data, [
                'delivery_note_number',
                'invoice_number',
                'invoiced_at',
                'pickup_instructions',
                'dropoff_instructions',
                'ready_at',
                'collection_date',
                'service_type',
                'priority',
                'auto_assign',
                'notes',
                'metadata',
            ]));

            if (
                array_key_exists('requested_vehicle_type_id', $data) ||
                array_key_exists('requested_vehicle_type', $data)
            ) {
                $shipment->requested_vehicle_type_id = $this->resolveVehicleTypeId(
                    $data['requested_vehicle_type_id'] ?? null,
                    $data['requested_vehicle_type'] ?? null
                );
            }

            if (array_key_exists('invoice_number', $data) || array_key_exists('invoiced_at', $data)) {
                $shipment->invoiced_at = $this->resolveInvoicedAtForUpdate($data, $beforeInvoiceNumber, $shipment->invoice_number, $shipment->invoiced_at);
            }

            if (!empty($data['pickup_address'])) {
                $pickupLocation = $this->locationService->storeFromAddress(
                    $data['pickup_address'],
                    $shipment->merchant,
                    $shipment->environment,
                    'pickup'
                );
                $shipment->pickup_location_id = $pickupLocation->id;
            }

            if (!empty($data['dropoff_address'])) {
                $dropoffLocation = $this->locationService->storeFromAddress(
                    $data['dropoff_address'],
                    $shipment->merchant,
                    $shipment->environment,
                    'dropoff'
                );
                $shipment->dropoff_location_id = $dropoffLocation->id;
            }
            $shipment->save();

            if (!empty($data['parcels'])) {
                $shipment->parcels()->delete();
                $this->shipmentParcelService->createShipmentParcels($shipment, $data['parcels']);
            }

            return $shipment;
        });
    }

    private function resolveInvoicedAtForWrite(array $data): ?Carbon
    {
        if (!empty($data['invoiced_at'])) {
            return Carbon::parse($data['invoiced_at']);
        }

        if (!empty($data['invoice_number'])) {
            return now();
        }

        return null;
    }

    private function resolveInvoicedAtForUpdate(
        array $data,
        ?string $beforeInvoiceNumber,
        ?string $afterInvoiceNumber,
        $currentInvoicedAt
    ): ?Carbon {
        if (array_key_exists('invoiced_at', $data)) {
            return !empty($data['invoiced_at']) ? Carbon::parse($data['invoiced_at']) : null;
        }

        $invoiceNumberChanged = array_key_exists('invoice_number', $data) && $afterInvoiceNumber !== $beforeInvoiceNumber;
        if ($invoiceNumberChanged && !empty($afterInvoiceNumber)) {
            return now();
        }

        return $currentInvoicedAt ? Carbon::parse($currentInvoicedAt) : null;
    }

    private function resolveVehicleTypeId(
        ?string $vehicleTypeUuid,
        ?string $vehicleTypeCode = null
    ): ?int
    {
        if ($vehicleTypeUuid) {
            $vehicleTypeId = VehicleType::where('uuid', $vehicleTypeUuid)->value('id');
            if ($vehicleTypeId) {
                return $vehicleTypeId;
            }
        }

        if ($vehicleTypeCode) {
            return VehicleType::where('code', $vehicleTypeCode)->value('id');
        }

        return null;
    }
}
