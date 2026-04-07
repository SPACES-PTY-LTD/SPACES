import { apiFetch } from "@/lib/api/client"
import type { Location } from "@/lib/types"

export type CreatedOverTimePoint = {
  date: string
  quoted: number
  shiped: number
  booked: number
}

export type DashboardStats = {
  total_shipments: number
  delivered_shipments: number
  in_transit_bookings: number
  pending_shipments: number
  active_merchants: number
  active_quotes: number
  total_members: number
  vehicles_count: number
}

export type FleetStatusReport = {
  active: number
  maintenance: number
  standby: number
  total: number
}

export type MappedBookingMarker = {
  booking_id: string
  shipment_id?: string | null
  status: string
  latitude?: number | null
  longitude?: number | null
  merchant_order_ref?: string | null
  driver_name?: string | null
  vehicle_plate_number?: string | null
  vehicle_label?: string | null
  updated_at?: string | null
}

export type MappedBookingsReport = {
  success?: boolean
  data: MappedBookingMarker[]
  meta?: {
    counts_by_status?: Record<string, number>
    total?: number
  }
}

export type ShipmentsFullReportSortBy =
  | "date_created"
  | "collection_date"
  | "shipment_number"
  | "delivery_note_number"
  | "truck_plate_number"
  | "driver_name"
  | "shipment_status"
  | "delivered_volume"

export type ShipmentsFullReportParams = {
  merchant_id?: string
  date_created?: string
  created_from?: string
  created_to?: string
  collection_date?: string
  shipment_number?: string
  delivery_note_number?: string
  truck_plate_number?: string
  driver_id?: string
  from_location_id?: string
  to_location_id?: string
  location_tag_id?: string
  vehicle_tag_id?: string
  shipment_status?: string
  sort_by?: ShipmentsFullReportSortBy
  sort_direction?: "asc" | "desc"
  per_page?: number
  page?: number
}

export type ShipmentFullReportRow = {
  shipment_id?: string
  vehicle_id?: string
  date_created?: string
  collection_date?: string
  shipment_number?: string
  delivery_note_number?: string
  truck_plate_number?: string
  driver_id?: string
  driver?: string
  shipment_type?: string
  from_location?: Location | null
  from_time_in?: string
  from_time_to?: string
  from_time_out?: string
  to_location?: Location | null
  to_time_in?: string
  to_time_out?: string
  shipment_status?: string
  delivered_volume?: string
}

export type ShipmentsFullReportResponse = {
  success: boolean
  data: ShipmentFullReportRow[]
  meta?: {
    request_id?: string
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
  }
  error?: unknown
}

export type MissingDocumentsReportParams = {
  merchant_id?: string
  entity_type?: "shipment" | "driver" | "vehicle"
  sort_by?: "merchant_name" | "entity_type" | "entity_label" | "file_type_name"
  sort_dir?: "asc" | "desc"
  per_page?: number
  page?: number
}

export type MissingDocumentRow = {
  merchant_id: string
  merchant_name: string
  entity_type: "shipment" | "driver" | "vehicle"
  file_type_id: string
  file_type_name: string
  entity_id: string
  entity_label: string
}

export type MissingDocumentsSummaryRow = {
  merchant_id: string
  merchant_name: string
  entity_type: "shipment" | "driver" | "vehicle"
  file_type_id: string
  file_type_name: string
  missing_count: number
}

export type MissingDocumentsReportResponse = {
  success: boolean
  data: MissingDocumentRow[]
  meta?: {
    request_id?: string
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
    summary_by_type?: MissingDocumentsSummaryRow[]
  }
  error?: unknown
}

export type DocumentExpiryReportParams = {
  merchant_id?: string
  entity_type?: "shipment" | "driver" | "vehicle"
  status?: "expired" | "expiring"
  expiring_in_days?: number
  sort_by?:
    | "merchant_name"
    | "entity_type"
    | "entity_label"
    | "file_type_name"
    | "original_name"
    | "uploaded_at"
    | "expires_at"
    | "days_to_expiry"
  sort_dir?: "asc" | "desc"
  per_page?: number
  page?: number
}

export type DocumentExpiryRow = {
  merchant_id: string
  merchant_name: string
  entity_type: "shipment" | "driver" | "vehicle"
  file_type_id: string
  file_type_name: string
  entity_id?: string | null
  entity_label?: string | null
  file_id: string
  original_name?: string | null
  uploaded_at?: string | null
  expires_at?: string | null
  days_to_expiry?: number | null
  expiry_status: "expired" | "expiring"
}

export type DocumentExpiryReportResponse = {
  success: boolean
  data: DocumentExpiryRow[]
  meta?: {
    request_id?: string
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
  }
  error?: unknown
}

export type DocumentCoverageReportParams = {
  merchant_id?: string
  entity_type?: "shipment" | "driver" | "vehicle"
  sort_by?:
    | "merchant_name"
    | "entity_type"
    | "file_type_name"
    | "required_count"
    | "uploaded_count"
    | "missing_count"
    | "expired_count"
    | "compliance_percent"
  sort_dir?: "asc" | "desc"
  per_page?: number
  page?: number
}

export type DocumentCoverageRow = {
  merchant_id?: string | null
  merchant_name?: string | null
  entity_type: "shipment" | "driver" | "vehicle"
  file_type_id: string
  file_type_name: string
  required_count: number
  uploaded_count: number
  missing_count: number
  expired_count: number
  compliance_percent?: number | null
}

export type DocumentCoverageReportResponse = {
  success: boolean
  data: DocumentCoverageRow[]
  meta?: {
    request_id?: string
    current_page?: number
    per_page?: number
    total?: number
    last_page?: number
  }
  error?: unknown
}

export type ShipmentsByLocationReportParams = {
  merchant_id?: string
  date_range?:
    | "today"
    | "yesterday"
    | "thisweek"
    | "1week"
    | "2weeks"
    | "30days"
    | "1month"
    | "3months"
    | "6months"
    | "1year"
    | "alltime"
    | "custom"
  location_type?: "pickup" | "dropoff"
  start_date?: string
  end_date?: string
}

export type ShipmentsByLocationRow = {
  location_id?: string | null
  location_name: string
  city?: string | null
  total_shipments: number
  href?: string
}

export type ShipmentsByLocationReportResponse = {
  success: boolean
  data: ShipmentsByLocationRow[]
  meta?: {
    total_locations?: number
    total_shipments?: number
    date_range?: string
    location_type?: "pickup" | "dropoff"
  }
  error?: unknown
}

export async function getCreatedOverTime(
  dateRange: string,
  token?: string | null,
  params?: { merchant_id?: string }
) {
  return apiFetch<{ success: boolean; data: CreatedOverTimePoint[] }>(
    "/api/v1/reports/created_over_time",
    { params: { date_range: dateRange, merchant_id: params?.merchant_id }, token }
  )
}

export async function getDashboardStats(
  token?: string | null,
  params?: { merchant_id?: string }
) {
  return apiFetch<{ success: boolean; data: DashboardStats }>(
    "/api/v1/reports/dashboard_stats",
    { token, params }
  )
}

export async function getFleetStatus(
  token?: string | null,
  params?: { merchant_id?: string }
) {
  return apiFetch<{ success: boolean; data: FleetStatusReport }>(
    "/api/v1/reports/fleet_status",
    { token, params }
  )
}

export async function getMappedBookings(
  params?: { merchant_id?: string; search?: string },
  token?: string | null
) {
  return apiFetch<MappedBookingsReport>("/api/v1/reports/mapped-bookings", {
    token,
    params,
  })
}

export async function getShipmentsFullReport(
  params?: ShipmentsFullReportParams,
  token?: string | null
) {
  return apiFetch<ShipmentsFullReportResponse>(
    "/api/v1/reports/shipments_full_report",
    { token, params }
  )
}

export async function getMissingDocumentsReport(
  params?: MissingDocumentsReportParams,
  token?: string | null
) {
  return apiFetch<MissingDocumentsReportResponse>("/api/v1/reports/missing-documents", {
    token,
    params,
  })
}

export async function getDocumentExpiryReport(
  params?: DocumentExpiryReportParams,
  token?: string | null
) {
  return apiFetch<DocumentExpiryReportResponse>("/api/v1/reports/document-expiry", {
    token,
    params,
  })
}

export async function getDocumentCoverageReport(
  params?: DocumentCoverageReportParams,
  token?: string | null
) {
  return apiFetch<DocumentCoverageReportResponse>("/api/v1/reports/document-coverage", {
    token,
    params,
  })
}

export async function getShipmentsByLocationReport(
  params?: ShipmentsByLocationReportParams,
  token?: string | null
) {
  return apiFetch<ShipmentsByLocationReportResponse>("/api/v1/reports/shipments-by-location", {
    token,
    params,
  })
}
