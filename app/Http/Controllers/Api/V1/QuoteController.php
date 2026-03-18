<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\CreateQuoteRequest;
use App\Http\Resources\QuoteResource;
use App\Models\Merchant;
use App\Models\Quote;
use App\Models\Shipment;
use App\Services\QuoteService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class QuoteController extends Controller
{
    public function index(Request $request, QuoteService $service)
    {
        try {
            $quotes = $service->listQuotes($request->user(), $request->all());

            return ApiResponse::paginated($quotes, QuoteResource::collection($quotes));
        } catch (Throwable $e) {
            Log::error('Quote list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'QUOTE_LIST_FAILED', 'Unable to list quotes.');
        }
    }

    public function store(CreateQuoteRequest $request, QuoteService $service)
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
                $this->authorize('create', [Quote::class, $merchant]);
            }

            $quote = $service->createQuote($request->validated(), true);

            return ApiResponse::success(
                new QuoteResource($quote->load('options')),
                [],
                Response::HTTP_CREATED
            );
        } catch (Throwable $e) {
            Log::error('Quote create failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'QUOTE_CREATE_FAILED', 'Unable to create quote.');
        }
    }

    public function show(string $quote_uuid, QuoteService $service)
    {
        try {
            $quote = $service->getQuoteByUuid($quote_uuid);
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($quote->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($quote->environment_id && $quote->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('view', $quote);
            }

            return ApiResponse::success(new QuoteResource($quote->load('options')));
        } catch (Throwable $e) {
            Log::error('Quote fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'QUOTE_NOT_FOUND', 'Quote not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function listForShipment(Request $request, string $shipment_uuid, QuoteService $service)
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
                $this->authorize('view', $shipment);
            }

            $quotes = $service->listShipmentQuotes($shipment, (int) $request->get('per_page', 15));

            return ApiResponse::paginated($quotes, QuoteResource::collection($quotes));
        } catch (Throwable $e) {
            Log::error('Quote list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'QUOTE_LIST_FAILED', 'Unable to list quotes.');
        }
    }
}
