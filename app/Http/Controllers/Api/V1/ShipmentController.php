<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignShipmentDriverRequest;
use App\Http\Requests\StoreShipmentRequest;
use App\Http\Requests\UpdateShipmentDeliveryNoteRequest;
use App\Http\Requests\UpdateShipmentInvoiceNumberRequest;
use App\Http\Requests\UpdateShipmentRequest;
use App\Http\Resources\BookingResource;
use App\Http\Resources\ShipmentResource;
use App\Http\Resources\TrackingEventResource;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Services\BookingService;
use App\Services\RunService;
use App\Services\ShipmentService;
use App\Services\TrackingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Symfony\Component\HttpKernel\Exception\UnprocessableEntityHttpException;
use Throwable;

class ShipmentController extends Controller
{
    public function store(StoreShipmentRequest $request, ShipmentService $service)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                $merchant = $environment->merchant;
                if ($merchant->uuid !== $request->validated()['merchant_id']) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $merchant = Merchant::where('uuid', $request->validated()['merchant_id'])->firstOrFail();
                $this->authorize('create', [Shipment::class, $merchant]);
            }

            $result = $service->createShipment($request->validated());
            $shipment = $result['shipment'];
            $created = (bool) ($result['created'] ?? false);
            $message = $result['message'] ?? null;

            return ApiResponse::success(
                new ShipmentResource($this->loadShipmentRelations($shipment)),
                ['message' => $message],
                $created ? Response::HTTP_CREATED : Response::HTTP_OK
            );
        } catch (Throwable $e) {
            Log::error('Shipment create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_CREATE_FAILED', 'Unable to create shipment.');
        }
    }

    public function requestOnDemand(StoreShipmentRequest $request, BookingService $bookingService)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                $merchant = $environment->merchant;
                if ($merchant->uuid !== $request->validated()['merchant_id']) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $merchant = Merchant::where('uuid', $request->validated()['merchant_id'])->firstOrFail();
                $this->authorize('create', [Shipment::class, $merchant]);
            }

            $payload = $request->validated();
            if (!array_key_exists('auto_assign', $payload)) {
                $payload['auto_assign'] = true;
            }
            if (empty($payload['service_type'])) {
                $payload['service_type'] = 'on_demand';
            }

            $result = $bookingService->requestOnDemand($payload, (bool) $request->get('sync'));

            return ApiResponse::success([
                'shipment' => new ShipmentResource($result['shipment']->load(
                    'parcels',
                    'merchant',
                    'pickupLocation',
                    'dropoffLocation',
                    'requestedVehicleType',
                    'currentRunShipment.run.driver.user',
                    'currentRunShipment.run.vehicle.lastDriver.user',
                    'vehicleActivities.merchant',
                    'vehicleActivities.vehicle.lastDriver.user',
                    'vehicleActivities.location',
                    'vehicleActivities.run.driver.user',
                    'vehicleActivities.shipment'
                )),
                'booking' => $result['booking']
                    ? new BookingResource($result['booking']->loadMissing([
                        'shipment.pickupLocation',
                        'shipment.dropoffLocation',
                        'quoteOption',
                        'merchant',
                        'currentDriver.user',
                        'pod',
                    ]))
                    : null,
                'status' => $result['status'],
            ], [
                'message' => $result['message'] ?? null,
            ], ($result['created'] ?? false) ? Response::HTTP_CREATED : Response::HTTP_OK);
        } catch (Throwable $e) {
            Log::error('On-demand dispatch request failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ON_DEMAND_DISPATCH_FAILED', 'Unable to process on-demand dispatch request.');
        }
    }

    public function index(Request $request, ShipmentService $service)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                $shipments = $service->listShipmentsForEnvironment($environment, $request->all());
            } else {
                $shipments = $service->listShipments($request->user(), $request->all());
            }

            return ApiResponse::paginated($shipments, ShipmentResource::collection($shipments));
        } catch (Throwable $e) {
            Log::error('Shipment list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_LIST_FAILED', 'Unable to list shipments.'.$e->getMessage());
        }
    }

    public function assignDriver(string $shipment_uuid, AssignShipmentDriverRequest $request, RunService $runService)
    {
        try {
            $shipment = Shipment::with('currentRunShipment.run')->where('uuid', $shipment_uuid)->firstOrFail();
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('update', $shipment);
            }

            [$shipment, $created] = $runService->assignShipmentDriver($shipment, $request->validated());

            return ApiResponse::success(
                new ShipmentResource($this->loadShipmentRelations($shipment)),
                [],
                $created ? Response::HTTP_CREATED : Response::HTTP_OK
            );
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('RUN_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (UnprocessableEntityHttpException $e) {
            return ApiResponse::error('VALIDATION', $e->getMessage(), [], Response::HTTP_UNPROCESSABLE_ENTITY);
        } catch (Throwable $e) {
            Log::error('Shipment assign driver failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_ASSIGN_DRIVER_FAILED', 'Unable to assign driver to shipment.');
        }
    }

    public function show(string $shipment_uuid)
    {
        try {
            $shipment = Shipment::with([
                'parcels',
                'merchant',
                'pickupLocation',
                'dropoffLocation',
                'requestedVehicleType',
                'currentRunShipment.run.driver.user',
                'currentRunShipment.run.vehicle.lastDriver.user',
                'vehicleActivities.merchant',
                'vehicleActivities.vehicle.lastDriver.user',
                'vehicleActivities.location',
                'vehicleActivities.run.driver.user',
                'vehicleActivities.shipment',
            ])
                ->where('uuid', $shipment_uuid)
                ->firstOrFail();
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('view', $shipment);
            }

            if (request()->user()?->role !== 'driver') {
                $shipment->load([
                    'deliveryOffers.driver.user',
                    'deliveryOffers.shipment.pickupLocation',
                    'deliveryOffers.shipment.dropoffLocation',
                    'deliveryOffers.shipment.requestedVehicleType',
                ]);
            }

            return ApiResponse::success(new ShipmentResource($shipment));
        } catch (Throwable $e) {
            Log::error('Shipment fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_NOT_FOUND', 'Shipment not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function update(UpdateShipmentRequest $request, string $shipment_uuid, ShipmentService $service)
    {
        try {
            $shipment = Shipment::where('uuid', $shipment_uuid)->firstOrFail();
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('update', $shipment);
            }

            if ($shipment->status !== 'draft') {
                return ApiResponse::error('SHIPMENT_LOCKED', 'Only draft shipments can be updated.', [], Response::HTTP_CONFLICT);
            }

            $shipment = $service->updateShipment($shipment, $request->validated());

            return ApiResponse::success(new ShipmentResource($this->loadShipmentRelations($shipment)));
        } catch (Throwable $e) {
            Log::error('Shipment update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_UPDATE_FAILED', 'Unable to update shipment.');
        }
    }

    public function updateDeliveryNoteNumber(UpdateShipmentDeliveryNoteRequest $request, string $shipment_uuid, ShipmentService $service)
    {
        try {
            $shipment = Shipment::where('uuid', $shipment_uuid)->firstOrFail();
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('update', $shipment);
            }

            if ($shipment->invoiced_at) {
                return ApiResponse::error('SHIPMENT_INVOICED', 'Delivery note number cannot be updated after the shipment has been invoiced.', [], Response::HTTP_CONFLICT);
            }

            $shipment = $service->updateDeliveryNoteNumber($shipment, $request->validated('delivery_note_number'));

            return ApiResponse::success(new ShipmentResource($this->loadShipmentRelations($shipment)));
        } catch (Throwable $e) {
            Log::error('Shipment delivery note update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_DELIVERY_NOTE_UPDATE_FAILED', 'Unable to update shipment delivery note number.');
        }
    }

    public function updateInvoiceNumber(UpdateShipmentInvoiceNumberRequest $request, string $shipment_uuid, ShipmentService $service)
    {
        try {
            $shipment = Shipment::where('uuid', $shipment_uuid)->firstOrFail();
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('update', $shipment);
            }

            if (trim((string) ($shipment->delivery_note_number ?? '')) === '') {
                return ApiResponse::error(
                    'SHIPMENT_DELIVERY_NOTE_REQUIRED',
                    'Delivery note number is required before updating the invoice number.',
                    [],
                    Response::HTTP_UNPROCESSABLE_ENTITY
                );
            }

            $invoiceNumber = trim($request->validated('invoice_number'));
            $shipment = $service->updateInvoiceNumber($shipment, $invoiceNumber);

            return ApiResponse::success(new ShipmentResource($this->loadShipmentRelations($shipment)));
        } catch (Throwable $e) {
            Log::error('Shipment invoice number update failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_INVOICE_NUMBER_UPDATE_FAILED', 'Unable to update shipment invoice number.');
        }
    }

    public function destroy(string $shipment_uuid)
    {
        try {
            $shipment = Shipment::where('uuid', $shipment_uuid)->firstOrFail();
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('delete', $shipment);
            }

            $shipment->delete();

            return ApiResponse::success(['message' => 'Shipment deleted']);
        } catch (Throwable $e) {
            Log::error('Shipment delete failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'SHIPMENT_DELETE_FAILED', 'Unable to delete shipment.');
        }
    }

    public function label(string $shipment_uuid)
    {
        try {
            $shipment = Shipment::with('booking')->where('uuid', $shipment_uuid)->firstOrFail();
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('view', $shipment);
            }

            $labelUrl = optional($shipment->booking)->label_url;
            if (!$labelUrl) {
                return ApiResponse::success(['status' => 'processing'], [], Response::HTTP_ACCEPTED);
            }

            return ApiResponse::success(['label_url' => $labelUrl]);
        } catch (Throwable $e) {
            Log::error('Shipment label failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'LABEL_FAILED', 'Unable to fetch label.');
        }
    }

    public function tracking(string $shipment_uuid, TrackingService $trackingService)
    {
        try {
            $shipment = Shipment::where('uuid', $shipment_uuid)->firstOrFail();
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($shipment->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($shipment->environment_id && $shipment->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('view', $shipment);
            }

            $trackingService->maybeSync($shipment);
            $events = $trackingService->listEvents($shipment);

            return ApiResponse::success(TrackingEventResource::collection($events));
        } catch (Throwable $e) {
            Log::error('Shipment tracking failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'TRACKING_FAILED', 'Unable to fetch tracking.');
        }
    }

    private function loadShipmentRelations(Shipment $shipment): Shipment
    {
        return $shipment->load(
            'parcels',
            'merchant',
            'pickupLocation',
            'dropoffLocation',
            'requestedVehicleType',
            'currentRunShipment.run.driver.user',
            'currentRunShipment.run.vehicle.lastDriver.user',
            'vehicleActivities.merchant',
            'vehicleActivities.vehicle.lastDriver.user',
            'vehicleActivities.location',
            'vehicleActivities.run.driver.user',
            'vehicleActivities.shipment'
        );
    }
}
