import { apiFetch } from "@/lib/api/client"
import type { ApiEnvelope, Run } from "@/lib/types"

export type ScheduleLocation = { location_id: string; name: string }
export type ScheduleShipment = {
  shipment_id: string; reference: string; delivery_note_number?: string | null
  collection_date?: string | null; status: string; source_run_id: string | null
  pickup: ScheduleLocation | null; dropoff: ScheduleLocation | null
}
export type ScheduleDriver = {
  driver_id: string; name: string; phone?: string | null; profile_photo_url?: string | null; assigned: boolean
  assigned_runs?: { run_id: string; status: string; planned_start_at: string | null }[]
}
export type ScheduleRun = {
  run_id: string; status: string; schedule_managed: boolean
  planned_start_at: string | null; started_at: string | null; overdue: boolean; waiting_reason: string | null
  can_assign_driver: boolean; can_add_shipment: boolean
  origin: ScheduleLocation | null; destination: ScheduleLocation | null
  driver: Pick<ScheduleDriver, "driver_id" | "name"> | null; shipments: ScheduleShipment[]
}
export type ScheduleTruck = {
  vehicle_id: string; plate_number: string; ref_code?: string | null
  is_active: boolean; available: boolean; can_create: boolean; runs: ScheduleRun[]
}
export type SchedulePage = { current_page: number; last_page: number; total: number }
export type ScheduleData = {
  summary?: { unassigned_drivers: number; available_trucks: number; active_runs: number; overdue_plans: number; unassigned_shipments: number }
  environments: { environment_id: string; name: string }[]
  timezone: string; can_manage: boolean; trucks: ScheduleTruck[]; drivers: ScheduleDriver[]; shipments: ScheduleShipment[]
  pagination: { trucks: SchedulePage; drivers: SchedulePage; shipments: SchedulePage }
}
export type ScheduleFilters = {
  from: string; to: string; truck_search: string; driver_search: string; shipment_search: string
  availability: string; fleet_status: string; driver_filter: string; shipment_statuses?: string
  driver_page: number; shipment_page: number
}
export type ScheduleItem = { kind: "driver"; driver: ScheduleDriver } | { kind: "shipment"; shipment: ScheduleShipment }
export type CreateScheduledRun = {
  merchant_id: string; environment_id?: string; vehicle_id: string; driver_id?: string
  schedule_managed: true; schedule_request_id: string; origin_location_id: string; destination_location_id: string
  planned_start_at: string; shipment_ids?: string[]
}
export function getSchedule(merchantId: string, environmentId: string | undefined, filters: ScheduleFilters, token?: string, signal?: AbortSignal) {
  return apiFetch<ApiEnvelope<ScheduleData>>("/api/v1/schedule", { token, signal, params: { merchant_id: merchantId, environment_id: environmentId, ...filters } })
}
export function createScheduledRun(payload: CreateScheduledRun, token?: string) {
  return apiFetch<ApiEnvelope<Run>>("/api/v1/runs", { method: "POST", token, body: payload })
}
export function assignScheduledDriver(runId: string, driverId: string | null, expectedDriverId: string | null, token?: string) {
  return apiFetch<ApiEnvelope<Run>>(`/api/v1/runs/${runId}`, { method: "PATCH", token, body: { driver_id: driverId, expected_driver_id: expectedDriverId } })
}
export function transferScheduledShipment(merchantId: string, environmentId: string | undefined, shipment: ScheduleShipment, targetRunId: string | null, token?: string) {
  return apiFetch<ApiEnvelope<unknown>>("/api/v1/schedule/transfer", { method: "POST", token, body: {
    merchant_id: merchantId, environment_id: environmentId, shipment_id: shipment.shipment_id,
    expected_source_run_id: shipment.source_run_id, target_run_id: targetRunId,
  } })
}
