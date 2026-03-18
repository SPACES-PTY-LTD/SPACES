import { apiFetch, isApiErrorResponse } from "@/lib/api/client"
import type { ApiEnvelope, ApiListResponse, Booking, Vehicle, VehicleType } from "@/lib/types"

export async function listDriverBookings(
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<Booking>>("/api/v1/driver/bookings", {
    token,
    params,
  })
}

export async function getDriverBooking(bookingId: string, token?: string | null) {
  const response = await apiFetch<ApiEnvelope<Booking>>(
    `/api/v1/driver/bookings/${bookingId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function updateDriverBookingStatus(
  bookingId: string,
  payload: { status: string },
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/driver/bookings/${bookingId}/status`, {
    method: "PATCH",
    body: payload,
    token,
  })
}

export async function createDriverScan(
  bookingId: string,
  payload: FormData,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/driver/bookings/${bookingId}/scan`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function uploadDriverPod(
  bookingId: string,
  payload: FormData,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/driver/bookings/${bookingId}/pod`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function cancelDriverBooking(
  bookingId: string,
  payload: { reason: string },
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/driver/bookings/${bookingId}/cancel`, {
    method: "POST",
    body: payload,
    token,
  })
}

export async function listDriverVehicles(
  token?: string | null,
  params?: { page?: number }
) {
  return apiFetch<ApiListResponse<Vehicle>>("/api/v1/driver/vehicles", {
    token,
    params,
  })
}

export async function getDriverVehicle(
  vehicleId: string,
  token?: string | null
) {
  const response = await apiFetch<ApiEnvelope<Vehicle>>(
    `/api/v1/driver/vehicles/${vehicleId}`,
    { token }
  )
  if (isApiErrorResponse(response)) {
    return response
  }
  return response.data
}

export async function createDriverVehicle(
  payload: Partial<VehicleType>,
  token?: string | null
) {
  return apiFetch<VehicleType>("/api/v1/driver/vehicles", {
    method: "POST",
    body: payload,
    token,
  })
}

export async function updateDriverVehicle(
  vehicleId: string,
  payload: Partial<VehicleType>,
  token?: string | null
) {
  return apiFetch<VehicleType>(
    `/api/v1/driver/vehicles/${vehicleId}`,
    { method: "PATCH", body: payload, token }
  )
}

export async function deleteDriverVehicle(
  vehicleId: string,
  token?: string | null
) {
  return apiFetch<void>(`/api/v1/driver/vehicles/${vehicleId}`, {
    method: "DELETE",
    token,
  })
}
