<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\BookShipmentRequest;
use App\Http\Requests\CancelShipmentRequest;
use App\Http\Resources\BookingResource;
use App\Models\Booking;
use App\Models\QuoteOption;
use App\Models\Shipment;
use App\Services\BookingService;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class BookingController extends Controller
{
    public function book(BookShipmentRequest $request, string $shipment_uuid, BookingService $service)
    {
        // echo "here";
        // exit();
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

            if ($shipment->booking) {
                return ApiResponse::error('SHIPMENT_ALREADY_BOOKED', 'Shipment already booked.', [], Response::HTTP_CONFLICT);
            }

            $option = QuoteOption::where('uuid', $request->validated()['quote_option_id'])->firstOrFail();
            if ($option->quote?->shipment_id !== $shipment->id) {
                return ApiResponse::error('QUOTE_OPTION_MISMATCH', 'Quote option does not belong to this shipment.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }
            $booking = $service->bookShipment($shipment, $option, (bool) $request->get('sync'));

            return ApiResponse::success([
                'booking_id' => $booking->uuid,
                'status' => 'processing',
            ], [], Response::HTTP_ACCEPTED);
        } catch (Throwable $e) {
            Log::error('Booking failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BOOKING_FAILED', 'Unable to book shipment.');
        }
    }

    public function rebook(BookShipmentRequest $request, string $shipment_uuid, BookingService $service)
    {
        try {
            $shipment = Shipment::with('booking')->where('uuid', $shipment_uuid)->firstOrFail();
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

            $option = QuoteOption::where('uuid', $request->validated()['quote_option_id'])->firstOrFail();
            if ($option->quote?->shipment_id !== $shipment->id) {
                return ApiResponse::error('QUOTE_OPTION_MISMATCH', 'Quote option does not belong to this shipment.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $booking = $service->rebookShipment($shipment, $option, (bool) $request->get('sync'));

            return ApiResponse::success([
                'booking_id' => $booking->uuid,
                'status' => 'processing',
            ], ['message' => 'Rebooking started.']);
        } catch (Throwable $e) {
            Log::error('Rebooking failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'REBOOKING_FAILED', 'Unable to rebook shipment.');
        }
    }

    public function index(Request $request, BookingService $service)
    {
        try {
            $environment = $request->attributes->get('merchant_environment');
            if ($environment) {
                $bookings = $service->listBookingsForEnvironment($environment, $request->all());
            } else {
                $bookings = $service->listBookings($request->user(), $request->all());
            }

            return ApiResponse::paginated($bookings, BookingResource::collection($bookings));
        } catch (Throwable $e) {
            Log::error('Booking list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BOOKING_LIST_FAILED', 'Unable to list bookings.');
        }
    }

    public function show(string $booking_uuid)
    {
        try {
            $booking = Booking::with([
                'shipment.pickupLocation',
                'shipment.dropoffLocation',
                'quoteOption',
                'merchant',
                'currentDriver.user',
                'pod',
            ])->where('uuid', $booking_uuid)->firstOrFail();
            $environment = request()->attributes->get('merchant_environment');
            if ($environment) {
                if ($booking->merchant_id !== $environment->merchant_id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
                if ($booking->environment_id && $booking->environment_id !== $environment->id) {
                    return ApiResponse::error('FORBIDDEN', 'You are not authorized to access this resource.', [], Response::HTTP_FORBIDDEN);
                }
            } else {
                $this->authorize('view', $booking);
            }

            return ApiResponse::success(new BookingResource($booking));
        } catch (Throwable $e) {
            Log::error('Booking fetch failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BOOKING_NOT_FOUND', 'Booking not found.', Response::HTTP_NOT_FOUND);
        }
    }

    public function cancel(CancelShipmentRequest $request, string $shipment_uuid, BookingService $service)
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

            $booking = $service->cancelBooking($shipment, $request->validated(), (bool) $request->get('sync'));

            return ApiResponse::success(new BookingResource($booking));
        } catch (Throwable $e) {
            Log::error('Booking cancel failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'BOOKING_CANCEL_FAILED', 'Unable to cancel booking.');
        }
    }
}
