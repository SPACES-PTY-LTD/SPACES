<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\AssignDriverRequest;
use App\Http\Resources\DriverAssignmentResource;
use App\Models\Booking;
use App\Models\Carrier;
use App\Models\Driver;
use App\Models\DriverAssignment;
use App\Support\ApiResponse;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AdminDriverAssignmentController extends Controller
{
    public function assign(AssignDriverRequest $request, string $booking_uuid)
    {
        try {
            $booking = Booking::with('assignments')->where('uuid', $booking_uuid)->firstOrFail();

            $carrier = Carrier::where('code', $booking->carrier_code)->first();
            if (!$carrier || $carrier->type !== 'internal') {
                return ApiResponse::error('INVALID_CARRIER', 'Driver assignments are only allowed for internal carriers.', [], Response::HTTP_UNPROCESSABLE_ENTITY);
            }

            $driver = Driver::where('uuid', $request->validated()['driver_id'])->firstOrFail();

            DriverAssignment::where('booking_id', $booking->id)
                ->whereNull('unassigned_at')
                ->update(['unassigned_at' => now()]);

            $assignment = DriverAssignment::create([
                'account_id' => $booking->account_id,
                'booking_id' => $booking->id,
                'driver_id' => $driver->id,
                'assigned_by_user_id' => $request->user()?->id,
                'assigned_at' => now(),
                'notes' => $request->validated()['notes'] ?? null,
            ]);

            $booking->update(['current_driver_id' => $driver->id]);

            $assignment->load(['booking', 'driver', 'assignedBy']);

            return ApiResponse::success(new DriverAssignmentResource($assignment));
        } catch (Throwable $e) {
            Log::error('Admin assign driver failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_ASSIGN_DRIVER_FAILED', 'Unable to assign driver.');
        }
    }

    public function unassign(string $booking_uuid)
    {
        try {
            $booking = Booking::where('uuid', $booking_uuid)->firstOrFail();

            DriverAssignment::where('booking_id', $booking->id)
                ->whereNull('unassigned_at')
                ->update(['unassigned_at' => now()]);

            $booking->update(['current_driver_id' => null]);

            return ApiResponse::success(['message' => 'Driver unassigned']);
        } catch (Throwable $e) {
            Log::error('Admin unassign driver failed', ['request_id' => ApiResponse::requestId(), 'error' => $e->getMessage()]);
            return $this->apiError($e, 'ADMIN_UNASSIGN_DRIVER_FAILED', 'Unable to unassign driver.');
        }
    }
}
