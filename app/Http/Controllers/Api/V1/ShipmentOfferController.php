<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\DeliveryOfferResource;
use App\Models\Shipment;
use App\Services\DeliveryOfferService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class ShipmentOfferController extends Controller
{
    public function index(string $shipment_uuid, Request $request)
    {
        try {
            $shipment = Shipment::with([
                'deliveryOffers.driver.user',
                'deliveryOffers.shipment.pickupLocation',
                'deliveryOffers.shipment.dropoffLocation',
                'deliveryOffers.shipment.requestedVehicleType',
            ])->where('uuid', $shipment_uuid)->firstOrFail();
            $this->authorize('view', $shipment);

            return ApiResponse::success(DeliveryOfferResource::collection($shipment->deliveryOffers));
        } catch (Throwable $e) {
            Log::error('Shipment offers list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'SHIPMENT_OFFERS_FAILED', 'Unable to list shipment offers.');
        }
    }

    public function start(string $shipment_uuid, Request $request, DeliveryOfferService $deliveryOfferService)
    {
        try {
            $shipment = Shipment::with(['merchant', 'environment', 'pickupLocation', 'dropoffLocation', 'requestedVehicleType'])
                ->where('uuid', $shipment_uuid)
                ->firstOrFail();
            $this->authorize('update', $shipment);

            $offer = $deliveryOfferService->startOffersForShipment($shipment);

            return ApiResponse::success([
                'offer' => $offer ? new DeliveryOfferResource($offer) : null,
            ]);
        } catch (Throwable $e) {
            Log::error('Shipment offers start failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'SHIPMENT_OFFERS_START_FAILED', 'Unable to start delivery offers for shipment.');
        }
    }
}
