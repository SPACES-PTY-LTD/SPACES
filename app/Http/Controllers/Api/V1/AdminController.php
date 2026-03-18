<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\BookingResource;
use App\Http\Resources\MerchantResource;
use App\Http\Resources\ShipmentResource;
use App\Http\Resources\UserResource;
use App\Http\Resources\WebhookDeliveryResource;
use App\Models\Booking;
use App\Models\Merchant;
use App\Models\Shipment;
use App\Models\User;
use App\Models\WebhookDelivery;
use App\Support\ApiResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class AdminController extends Controller
{
    public function users(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $sortableColumns = [
                'created_at' => 'created_at',
                'name' => 'name',
                'email' => 'email',
                'role' => 'role',
            ];
            $sortBy = (string) $request->get('sort_by', 'created_at');
            $sortColumn = $sortableColumns[$sortBy] ?? $sortableColumns['created_at'];
            $sortDirection = strtolower((string) $request->get('sort_direction', $request->get('sort_dir', 'desc')));
            $sortDirection = in_array($sortDirection, ['asc', 'desc'], true) ? $sortDirection : 'desc';
            $users = User::query()
                ->orderBy($sortColumn, $sortDirection)
                ->orderBy('id')
                ->paginate($perPage);

            return ApiResponse::paginated($users, UserResource::collection($users));
        } catch (Throwable $e) {
            Log::error('Admin users list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_USERS_FAILED', 'Unable to list users.');
        }
    }

    public function merchants(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $merchants = Merchant::orderByDesc('created_at')->paginate($perPage);

            return ApiResponse::paginated($merchants, MerchantResource::collection($merchants));
        } catch (Throwable $e) {
            Log::error('Admin merchants list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_MERCHANTS_FAILED', 'Unable to list merchants.');
        }
    }

    public function shipments(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $shipments = Shipment::with(['pickupLocation', 'dropoffLocation'])
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($shipments, ShipmentResource::collection($shipments));
        } catch (Throwable $e) {
            Log::error('Admin shipments list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_SHIPMENTS_FAILED', 'Unable to list shipments.');
        }
    }

    public function bookings(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $bookings = Booking::with([
                'shipment.pickupLocation',
                'shipment.dropoffLocation',
                'quoteOption',
                'merchant',
                'environment',
                'currentDriver.user',
                'pod',
            ])
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($bookings, BookingResource::collection($bookings));
        } catch (Throwable $e) {
            Log::error('Admin bookings list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_BOOKINGS_FAILED', 'Unable to list bookings.');
        }
    }

    public function webhookDeliveries(Request $request)
    {
        try {
            $perPage = min((int) $request->get('per_page', 15), 100);
            $deliveries = WebhookDelivery::with(['merchant', 'subscription'])
                ->orderByDesc('created_at')
                ->paginate($perPage);

            return ApiResponse::paginated($deliveries, WebhookDeliveryResource::collection($deliveries));
        } catch (Throwable $e) {
            Log::error('Admin webhook deliveries list failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_WEBHOOK_DELIVERIES_FAILED', 'Unable to list webhook deliveries.');
        }
    }
}
