import type { VehicleActivity } from "@/lib/types"

export type StopAnalysisRow = {
  key: string
  locationId?: string
  locationName: string
  visitCount: number
  uniqueVehicleCount: number
  averageDwellMinutes: number | null
  maxDwellMinutes: number | null
  openVisits: number
  latestVisitAt: string | null
}

function parseDate(value?: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function minutesBetween(start?: string | null, end?: string | null): number | null {
  const startDate = parseDate(start)
  const endDate = parseDate(end)
  if (!startDate || !endDate) return null
  const diff = (endDate.getTime() - startDate.getTime()) / 60000
  return diff >= 0 ? diff : null
}

function locationLabel(activity: VehicleActivity): string {
  return (
    activity.location?.name ??
    activity.location?.company ??
    activity.location?.code ??
    activity.location?.location_id ??
    "Unknown location"
  )
}

// A second entry requires departure evidence for the same truck and location.
// Run/shipment changes and repeated observations do not create another visit.
export function distinctLocationVisits(rows: VehicleActivity[]): VehicleActivity[] {
  const groups = new Map<string, VehicleActivity[]>()
  for (const activity of rows) {
    const vehicleId = activity.vehicle?.vehicle_id ?? activity.vehicle_id
    const locationId = activity.location?.location_id ?? activity.location_id
    const entry = parseDate(activity.entered_at ?? activity.occurred_at)
    if (activity.event_type !== "entered_location" || !vehicleId || !locationId || !entry) continue
    const key = JSON.stringify([activity.merchant?.merchant_id ?? activity.merchant_id, vehicleId, locationId])
    const group = groups.get(key) ?? []
    const exit = parseDate(activity.exited_at)
    group.push({ ...activity, entered_at: entry.toISOString(), exited_at: exit && exit >= entry ? exit.toISOString() : null })
    groups.set(key, group)
  }

  const visits: VehicleActivity[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => new Date(a.entered_at!).getTime() - new Date(b.entered_at!).getTime())
    let current: VehicleActivity | undefined
    for (const activity of group) {
      const entry = new Date(activity.entered_at!).getTime()
      const previousEntry = current ? new Date(current.entered_at!).getTime() : null
      const previousExit = current?.exited_at ? new Date(current.exited_at).getTime() : null
      if (!current || (previousExit !== null && entry >= previousExit && entry > previousEntry!)) {
        current = { ...activity }
        visits.push(current)
      } else if (activity.exited_at && (!current.exited_at || activity.exited_at > current.exited_at)) {
        // Use recorded departure evidence shared by overlapping duplicate entries.
        current.exited_at = activity.exited_at
      }
    }
  }
  return visits
}

export function buildStopAnalysisRows(rows: VehicleActivity[]): StopAnalysisRow[] {
  const grouped = new Map<string, {
    locationId?: string
    locationName: string
    visitCount: number
    vehicles: Set<string>
    dwellTotal: number
    dwellCount: number
    maxDwell: number | null
    openVisits: number
    latestVisitAt: string | null
  }>()

  for (const activity of distinctLocationVisits(rows)) {
    const locationId = activity.location?.location_id ?? activity.location_id ?? undefined
    const key = locationId ?? locationLabel(activity)
    const current = grouped.get(key) ?? {
      locationId,
      locationName: locationLabel(activity),
      visitCount: 0,
      vehicles: new Set<string>(),
      dwellTotal: 0,
      dwellCount: 0,
      maxDwell: null,
      openVisits: 0,
      latestVisitAt: null,
    }

    current.visitCount += 1
    const vehicleId = activity.vehicle?.vehicle_id ?? activity.vehicle_id ?? undefined
    if (vehicleId) {
      current.vehicles.add(vehicleId)
    }

    const dwell = minutesBetween(activity.entered_at, activity.exited_at)
    if (dwell !== null) {
      current.dwellTotal += dwell
      current.dwellCount += 1
      current.maxDwell = current.maxDwell === null ? dwell : Math.max(current.maxDwell, dwell)
    } else {
      current.openVisits += 1
    }

    const lastVisit = activity.exited_at ?? activity.entered_at ?? activity.occurred_at ?? null
    if (!current.latestVisitAt || (parseDate(lastVisit)?.getTime() ?? 0) > (parseDate(current.latestVisitAt)?.getTime() ?? 0)) {
      current.latestVisitAt = lastVisit
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .map(([key, value]) => ({
      key,
      locationId: value.locationId,
      locationName: value.locationName,
      visitCount: value.visitCount,
      uniqueVehicleCount: value.vehicles.size,
      averageDwellMinutes: value.dwellCount > 0 ? value.dwellTotal / value.dwellCount : null,
      maxDwellMinutes: value.maxDwell,
      openVisits: value.openVisits,
      latestVisitAt: value.latestVisitAt,
    }))
}

export type StopAnalysisVisit = {
  vehicleId: string
  vehicleLabel: string
  enteredAt: string
  exitedAt: string | null
  dwellMinutes: number | null
}

export type StopAnalysisVehicle = {
  vehicleId: string
  vehicleLabel: string
  visitCount: number
  averageDwellMinutes: number | null
  maxDwellMinutes: number | null
  totalDwellMinutes: number | null
  openVisits: number
}

export type StopAnalysisDetails = {
  vehicles: StopAnalysisVehicle[]
  visits: StopAnalysisVisit[]
}

// Project only the selected report's visit evidence into the client drawer.
export function buildStopAnalysisDetails(rows: VehicleActivity[]): Record<string, StopAnalysisDetails> {
  const details: Record<string, StopAnalysisDetails> = {}
  for (const activity of distinctLocationVisits(rows)) {
    const locationId = (activity.location?.location_id ?? activity.location_id)!
    const vehicleId = (activity.vehicle?.vehicle_id ?? activity.vehicle_id)!
    const detail = details[locationId] ??= { vehicles: [], visits: [] }
    detail.visits.push({
      vehicleId,
      vehicleLabel: activity.vehicle?.plate_number || activity.vehicle?.ref_code || vehicleId,
      enteredAt: activity.entered_at!,
      exitedAt: activity.exited_at ?? null,
      dwellMinutes: minutesBetween(activity.entered_at, activity.exited_at),
    })
  }
  for (const detail of Object.values(details)) {
    const vehicles = new Map<string, StopAnalysisVehicle>()
    for (const visit of detail.visits) {
      const vehicle = vehicles.get(visit.vehicleId) ?? {
        vehicleId: visit.vehicleId, vehicleLabel: visit.vehicleLabel,
        visitCount: 0, averageDwellMinutes: null, maxDwellMinutes: null,
        totalDwellMinutes: null, openVisits: 0,
      }
      vehicle.visitCount += 1
      if (visit.dwellMinutes === null) vehicle.openVisits += 1
      else {
        vehicle.totalDwellMinutes = (vehicle.totalDwellMinutes ?? 0) + visit.dwellMinutes
        vehicle.maxDwellMinutes = Math.max(vehicle.maxDwellMinutes ?? 0, visit.dwellMinutes)
      }
      vehicles.set(visit.vehicleId, vehicle)
    }
    detail.vehicles = Array.from(vehicles.values()).map(vehicle => ({
      ...vehicle,
      averageDwellMinutes: vehicle.totalDwellMinutes === null ? null : vehicle.totalDwellMinutes / (vehicle.visitCount - vehicle.openVisits),
    })).sort((a, b) => b.visitCount - a.visitCount || a.vehicleLabel.localeCompare(b.vehicleLabel))
    detail.visits.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt) || a.vehicleLabel.localeCompare(b.vehicleLabel))
  }
  return details
}
