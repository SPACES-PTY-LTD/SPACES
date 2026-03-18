<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\DriverOfferDecisionRequest;
use App\Http\Resources\DeliveryOfferResource;
use App\Http\Resources\DriverShipmentResource;
use App\Models\DeliveryOffer;
use App\Services\DeliveryOfferService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;
use Throwable;

class DriverOfferController extends Controller
{
    public function index(Request $request, DeliveryOfferService $deliveryOfferService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $offers = $deliveryOfferService->activeOffersForDriver($driver);

            return ApiResponse::success(DeliveryOfferResource::collection($offers));
        } catch (Throwable $e) {
            Log::error('Driver offers list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_OFFERS_FAILED', 'Unable to list driver offers.');
        }
    }

    public function accept(string $offer_uuid, Request $request, DeliveryOfferService $deliveryOfferService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $offer = DeliveryOffer::where('uuid', $offer_uuid)->firstOrFail();
            $result = $deliveryOfferService->acceptOffer($offer, $driver);

            return ApiResponse::success([
                'offer' => new DeliveryOfferResource($result['offer']),
                'shipment' => new DriverShipmentResource($result['shipment']),
            ]);
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('DELIVERY_OFFER_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (Throwable $e) {
            Log::error('Driver offer accept failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_OFFER_ACCEPT_FAILED', 'Unable to accept delivery offer.');
        }
    }

    public function decline(string $offer_uuid, DriverOfferDecisionRequest $request, DeliveryOfferService $deliveryOfferService)
    {
        try {
            $driver = $request->user()?->driver;
            if (!$driver) {
                return ApiResponse::error('FORBIDDEN', 'Driver profile not found.', [], Response::HTTP_FORBIDDEN);
            }

            $offer = DeliveryOffer::where('uuid', $offer_uuid)->firstOrFail();
            $nextOffer = $deliveryOfferService->declineOffer($offer, $driver, $request->validated()['reason'] ?? null);

            return ApiResponse::success([
                'next_offer' => $nextOffer ? new DeliveryOfferResource($nextOffer) : null,
            ]);
        } catch (ConflictHttpException $e) {
            return ApiResponse::error('DELIVERY_OFFER_CONFLICT', $e->getMessage(), [], Response::HTTP_CONFLICT);
        } catch (Throwable $e) {
            Log::error('Driver offer decline failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);

            return $this->apiError($e, 'DRIVER_OFFER_DECLINE_FAILED', 'Unable to decline delivery offer.');
        }
    }
}
