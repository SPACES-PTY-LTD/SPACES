"use client"

import * as React from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { loadGoogleMaps } from "@/lib/googleMapsLoader"
import { AdminRoute } from "@/lib/routes/admin"
import type { Location, Run, RunShipment, RunTrackPoint, ShipmentStop } from "@/lib/types"
import { cn } from "@/lib/utils"

type Position = google.maps.LatLngLiteral
type StopLocation = Location | NonNullable<ShipmentStop["location"]>
type CheckpointKind = "start" | "stop" | "end"

type ShipmentRole = {
  key: string
  shipmentId: string
  reference: string
  role: "Pickup" | "Drop-off" | "Shipment"
}

type StopGroup = {
  key: string
  activities: ShipmentStop[]
  location: StopLocation | null
  position: Position | null
  startedAt: string | null
  endedAt: string | null
  startMs: number
  endMs: number
}

type JourneyCheckpoint = {
  key: string
  kind: CheckpointKind
  label: string
  activities: ShipmentStop[]
  location: StopLocation | null
  position: Position | null
  arrivedAt: string | null
  departedAt: string | null
  shipmentRoles: ShipmentRole[]
  isShipmentStop: boolean
  odometerKm: number | null
  segmentKm: number | null
  cumulativeKm: number | null
}

type RunJourney = {
  checkpoints: JourneyCheckpoint[]
  path: Position[]
  distanceMethod: "odometer" | "allocated" | "gps" | "unavailable"
  totalKm: number | null
}

const visitMergeWindowMs = 5 * 60 * 1000

function finiteNumber(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function timestampValue(value?: string | null) {
  if (!value) return null
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? null : timestamp
}

function activityStart(stop: ShipmentStop) {
  return stop.entered_at ?? stop.occurred_at ?? stop.created_at ?? null
}

function activityEnd(stop: ShipmentStop) {
  return stop.exited_at ?? stop.occurred_at ?? stop.entered_at ?? stop.created_at ?? null
}

function validPosition(latitude: unknown, longitude: unknown): Position | null {
  const lat = finiteNumber(latitude)
  const lng = finiteNumber(longitude)
  if (lat === null || lat < -90 || lat > 90 || lng === null || lng < -180 || lng > 180) return null
  return { lat, lng }
}

function activityPosition(stop: ShipmentStop) {
  return validPosition(
    stop.latitude ?? stop.location?.latitude,
    stop.longitude ?? stop.location?.longitude
  )
}

function locationPosition(location?: StopLocation | null) {
  return validPosition(location?.latitude, location?.longitude)
}

function distanceKm(from: Position, to: Position) {
  const earthRadiusKm = 6371.0088
  const latitudeDelta = ((to.lat - from.lat) * Math.PI) / 180
  const longitudeDelta = ((to.lng - from.lng) * Math.PI) / 180
  const fromLatitude = (from.lat * Math.PI) / 180
  const toLatitude = (to.lat * Math.PI) / 180
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2
  const boundedValue = Math.min(1, Math.max(0, value))
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(boundedValue), Math.sqrt(1 - boundedValue))
}

function sameVisit(group: StopGroup, stop: ShipmentStop) {
  const stopStart = timestampValue(activityStart(stop)) ?? group.endMs
  const stopEnd = timestampValue(activityEnd(stop)) ?? stopStart
  const groupLocationId = group.location?.location_id
  const stopLocationId = stop.location?.location_id
  const locationsConflict = Boolean(groupLocationId && stopLocationId && groupLocationId !== stopLocationId)
  const locationsMatch = Boolean(groupLocationId && stopLocationId && groupLocationId === stopLocationId)
  const stopPoint = activityPosition(stop)
  const positionsMatch = Boolean(group.position && stopPoint && distanceKm(group.position, stopPoint) <= 0.15)
  const visitsTouch = stopStart <= group.endMs + visitMergeWindowMs
    && stopEnd >= group.startMs - visitMergeWindowMs

  return !locationsConflict && visitsTouch && (locationsMatch || positionsMatch)
}

function createStopGroups(stops: ShipmentStop[]) {
  const orderedStops = [...stops].sort((left, right) => {
    const leftTime = timestampValue(activityStart(left)) ?? Number.MAX_SAFE_INTEGER
    const rightTime = timestampValue(activityStart(right)) ?? Number.MAX_SAFE_INTEGER
    return leftTime - rightTime
  })

  return orderedStops.reduce<StopGroup[]>((groups, stop, index) => {
    const startedAt = activityStart(stop)
    const endedAt = activityEnd(stop)
    const startMs = timestampValue(startedAt) ?? index
    const endMs = timestampValue(endedAt) ?? startMs
    const previous = groups.at(-1)

    if (previous && sameVisit(previous, stop)) {
      previous.activities.push(stop)
      previous.location ??= stop.location ?? null
      previous.position ??= activityPosition(stop)
      if (startMs < previous.startMs) {
        previous.startMs = startMs
        previous.startedAt = startedAt
      }
      if (endMs > previous.endMs) {
        previous.endMs = endMs
        previous.endedAt = endedAt
      }
      return groups
    }

    groups.push({
      key: stop.activity_id ?? `stop-${index}`,
      activities: [stop],
      location: stop.location ?? null,
      position: activityPosition(stop),
      startedAt,
      endedAt,
      startMs,
      endMs,
    })
    return groups
  }, [])
}

function checkpointMatchesGroup(
  checkpointTime: string | null,
  checkpointLocation: StopLocation | null,
  checkpointPosition: Position | null,
  group: StopGroup
) {
  const checkpointMs = timestampValue(checkpointTime)
  if (checkpointMs === null) return false
  const groupLocationId = group.location?.location_id
  const checkpointLocationId = checkpointLocation?.location_id
  const locationsConflict = Boolean(
    groupLocationId && checkpointLocationId && groupLocationId !== checkpointLocationId
  )
  const locationsMatch = Boolean(groupLocationId && checkpointLocationId && groupLocationId === checkpointLocationId)
  const positionsMatch = Boolean(
    checkpointPosition && group.position && distanceKm(checkpointPosition, group.position) <= 0.15
  )
  return !locationsConflict && (locationsMatch || positionsMatch)
    && checkpointMs >= group.startMs - visitMergeWindowMs
    && checkpointMs <= group.endMs + visitMergeWindowMs
}

function eventLabel(eventType?: string | null) {
  if (!eventType) return "Stop"
  return eventType
    .replaceAll("_", " ")
    .replace(/^./, (character) => character.toUpperCase())
}

function checkpointTitle(checkpoint: Pick<JourneyCheckpoint, "kind" | "location" | "activities">) {
  if (checkpoint.location?.name) return checkpoint.location.name
  if (checkpoint.location?.company) return checkpoint.location.company
  if (checkpoint.location?.code) return checkpoint.location.code
  if (checkpoint.kind === "start") return "Run start"
  if (checkpoint.kind === "end") return "Run end"
  return eventLabel(checkpoint.activities[0]?.event_type)
}

function metadataOdometer(stop: ShipmentStop) {
  const metadata = stop.metadata
  if (!metadata) return null
  const direct = finiteNumber(metadata.odometer_kilometres ?? metadata.odometer_km ?? metadata.odometer)
  if (direct !== null) return direct
  const providerPosition = metadata.provider_position
  if (!providerPosition || typeof providerPosition !== "object" || Array.isArray(providerPosition)) return null
  const provider = providerPosition as Record<string, unknown>
  return finiteNumber(provider.odometer_kilometres ?? provider.odometerKilometres ?? provider.odometer)
}

function groupOdometer(activities: ShipmentStop[]) {
  for (let index = activities.length - 1; index >= 0; index -= 1) {
    const odometer = metadataOdometer(activities[index])
    if (odometer !== null) return odometer
  }
  return null
}

function shipmentRoles(
  checkpoint: Pick<JourneyCheckpoint, "location" | "activities">,
  shipments: RunShipment[]
) {
  const roles = new Map<string, ShipmentRole>()
  const locationId = checkpoint.location?.location_id
  const activityShipmentIds = new Set(
    checkpoint.activities.map((activity) => activity.shipment?.shipment_id).filter(Boolean)
  )

  shipments.forEach((shipment) => {
    const reference = shipment.merchant_order_ref || shipment.shipment_id
    const addRole = (role: ShipmentRole["role"]) => {
      const key = `${shipment.shipment_id}-${role}`
      roles.set(key, { key, shipmentId: shipment.shipment_id, reference, role })
    }

    if (locationId && shipment.pickup_location?.location_id === locationId) addRole("Pickup")
    if (locationId && shipment.dropoff_location?.location_id === locationId) addRole("Drop-off")
    if (activityShipmentIds.has(shipment.shipment_id)
      && shipment.pickup_location?.location_id !== locationId
      && shipment.dropoff_location?.location_id !== locationId) {
      addRole("Shipment")
    }
  })

  checkpoint.activities.forEach((activity) => {
    const shipment = activity.shipment
    if (!shipment?.shipment_id) return
    const reference = shipment.merchant_order_ref || shipment.shipment_id
    const role: ShipmentRole["role"] = locationId === shipment.pickup_location?.location_id
      ? "Pickup"
      : locationId === shipment.dropoff_location?.location_id
        ? "Drop-off"
        : "Shipment"
    const key = `${shipment.shipment_id}-${role}`
    if (!roles.has(key)) {
      roles.set(key, {
        key,
        shipmentId: shipment.shipment_id,
        reference,
        role,
      })
    }
  })

  return [...roles.values()]
}

function sortedTrackPoints(points: RunTrackPoint[]) {
  return [...points]
    .filter((point) => validPosition(point.latitude, point.longitude) !== null)
    .sort((left, right) => {
      const leftTime = timestampValue(left.occurred_at) ?? Number.MAX_SAFE_INTEGER
      const rightTime = timestampValue(right.occurred_at) ?? Number.MAX_SAFE_INTEGER
      return leftTime - rightTime
    })
}

function closestTrackIndex(
  checkpoint: JourneyCheckpoint,
  trackPoints: RunTrackPoint[],
  minimumIndex: number
) {
  const activityIds = new Set(checkpoint.activities.map((activity) => activity.activity_id).filter(Boolean))
  const activityIndex = trackPoints.findIndex(
    (point, index) => index >= minimumIndex && activityIds.has(point.activity_id)
  )
  if (activityIndex >= 0) return activityIndex

  const checkpointTime = timestampValue(checkpoint.arrivedAt)
  if (checkpointTime !== null) {
    let closestIndex = minimumIndex
    let closestDifference = Number.POSITIVE_INFINITY
    for (let index = minimumIndex; index < trackPoints.length; index += 1) {
      const pointTime = timestampValue(trackPoints[index].occurred_at)
      if (pointTime === null) continue
      const difference = Math.abs(pointTime - checkpointTime)
      if (difference < closestDifference) {
        closestDifference = difference
        closestIndex = index
      }
    }
    return closestIndex
  }

  if (checkpoint.position) {
    let closestIndex = minimumIndex
    let closestDistance = Number.POSITIVE_INFINITY
    for (let index = minimumIndex; index < trackPoints.length; index += 1) {
      const position = validPosition(trackPoints[index].latitude, trackPoints[index].longitude)
      if (!position) continue
      const distance = distanceKm(checkpoint.position, position)
      if (distance < closestDistance) {
        closestDistance = distance
        closestIndex = index
      }
    }
    return closestIndex
  }

  return minimumIndex
}

function buildRunJourney(run: Run): RunJourney {
  const trackPoints = sortedTrackPoints(run.track_points ?? [])
  const path = trackPoints.map((point) => validPosition(point.latitude, point.longitude)!).filter(Boolean)
  const groups = createStopGroups(run.actual_stops ?? [])
  const startTime = run.started_at ?? trackPoints[0]?.occurred_at ?? null
  const endTime = run.completed_at ?? trackPoints.at(-1)?.occurred_at ?? null
  const startPosition = locationPosition(run.origin) ?? path[0] ?? null
  const endPosition = locationPosition(run.destination) ?? path.at(-1) ?? null
  const startGroupIndex = groups.findIndex((group) =>
    checkpointMatchesGroup(startTime, run.origin ?? null, startPosition, group)
  )
  const startGroup = startGroupIndex >= 0 ? groups.splice(startGroupIndex, 1)[0] : null
  const endGroupIndex = groups.findLastIndex((group) =>
    checkpointMatchesGroup(endTime, run.destination ?? null, endPosition, group)
  )
  const endGroup = endGroupIndex >= 0 ? groups.splice(endGroupIndex, 1)[0] : null

  const checkpointInputs: Array<Omit<JourneyCheckpoint, "label" | "shipmentRoles" | "isShipmentStop" | "segmentKm" | "cumulativeKm">> = [
    {
      key: "run-start",
      kind: "start",
      activities: startGroup?.activities ?? [],
      location: startGroup?.location ?? run.origin ?? null,
      position: startGroup?.position ?? startPosition,
      arrivedAt: startTime,
      departedAt: startGroup?.endedAt ?? startTime,
      odometerKm: finiteNumber(run.odometer_start_km) ?? groupOdometer(startGroup?.activities ?? []),
    },
    ...groups.map((group) => ({
      key: group.key,
      kind: "stop" as const,
      activities: group.activities,
      location: group.location,
      position: group.position,
      arrivedAt: group.startedAt,
      departedAt: group.endedAt,
      odometerKm: groupOdometer(group.activities),
    })),
    {
      key: "run-end",
      kind: "end",
      activities: endGroup?.activities ?? [],
      location: endGroup?.location ?? run.destination ?? null,
      position: endGroup?.position ?? endPosition,
      arrivedAt: endGroup?.startedAt ?? endTime,
      departedAt: endTime,
      odometerKm: finiteNumber(run.odometer_end_km) ?? groupOdometer(endGroup?.activities ?? []),
    },
  ]

  let checkpoints: JourneyCheckpoint[] = checkpointInputs.map((checkpoint) => {
    const roles = shipmentRoles(checkpoint, run.shipments ?? [])
    const withDisplayFields: JourneyCheckpoint = {
      ...checkpoint,
      label: "",
      shipmentRoles: roles,
      isShipmentStop: roles.length > 0,
      segmentKm: null,
      cumulativeKm: null,
    }
    withDisplayFields.label = checkpointTitle(withDisplayFields)
    return withDisplayFields
  })

  const odometers = checkpoints.map((checkpoint) => checkpoint.odometerKm)
  const hasCompleteOdometers = odometers.every((odometer) => odometer !== null)
    && odometers.every((odometer, index) => index === 0 || odometer! >= odometers[index - 1]!)

  if (hasCompleteOdometers) {
    const initialOdometer = odometers[0]!
    checkpoints = checkpoints.map((checkpoint, index) => ({
      ...checkpoint,
      segmentKm: index === 0 ? 0 : odometers[index]! - odometers[index - 1]!,
      cumulativeKm: odometers[index]! - initialOdometer,
    }))
    return {
      checkpoints,
      path,
      distanceMethod: "odometer",
      totalKm: odometers.at(-1)! - initialOdometer,
    }
  }

  const cumulativeTrackKm = trackPoints.reduce<number[]>((totals, point, index) => {
    if (index === 0) return [0]
    const previous = validPosition(trackPoints[index - 1].latitude, trackPoints[index - 1].longitude)!
    const current = validPosition(point.latitude, point.longitude)!
    totals.push(totals[index - 1] + distanceKm(previous, current))
    return totals
  }, [])
  let previousIndex = 0
  const routeWeights = checkpoints.map((checkpoint, index) => {
    if (index === 0 || trackPoints.length === 0) return 0
    const currentIndex = checkpoint.kind === "end"
      ? trackPoints.length - 1
      : closestTrackIndex(checkpoint, trackPoints, previousIndex)
    const weight = Math.max(0, cumulativeTrackKm[currentIndex] - cumulativeTrackKm[previousIndex])
    previousIndex = currentIndex
    return weight
  })
  let weightTotal = routeWeights.reduce((total, weight) => total + weight, 0)

  if (weightTotal === 0) {
    for (let index = 1; index < checkpoints.length; index += 1) {
      const previousPosition = checkpoints[index - 1].position
      const currentPosition = checkpoints[index].position
      routeWeights[index] = previousPosition && currentPosition
        ? distanceKm(previousPosition, currentPosition)
        : 0
    }
    weightTotal = routeWeights.reduce((total, weight) => total + weight, 0)
  }

  const runTotal = finiteNumber(run.distance_km ?? run.odometer_distance_km)
  const scale = runTotal !== null && weightTotal > 0 ? runTotal / weightTotal : 1
  let cumulativeKm = 0
  checkpoints = checkpoints.map((checkpoint, index) => {
    const segmentKm = index === 0 ? 0 : routeWeights[index] * scale
    cumulativeKm += segmentKm
    return { ...checkpoint, segmentKm, cumulativeKm }
  })

  return {
    checkpoints,
    path,
    distanceMethod: weightTotal === 0
      ? "unavailable"
      : runTotal !== null && Math.abs(scale - 1) > 0.001
        ? "allocated"
        : "gps",
    totalKm: runTotal ?? (weightTotal > 0 ? weightTotal : null),
  }
}

function formatKm(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "-"
  return `${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return new Intl.DateTimeFormat("en-ZA", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

function locationSubtitle(location?: StopLocation | null) {
  return location?.full_address || location?.company || location?.code || null
}

function markerIcon(checkpoint: JourneyCheckpoint) {
  const color = checkpoint.kind === "start"
    ? "#16a34a"
    : checkpoint.kind === "end"
      ? "#111827"
      : checkpoint.isShipmentStop
        ? "#d97706"
        : "#2563eb"
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 42 52">
      <path d="M21 2C11.1 2 3 10.1 3 20c0 13.4 15.1 27.4 16.8 28.9.7.7 1.8.7 2.5 0C23.9 47.4 39 33.4 39 20 39 10.1 30.9 2 21 2z" fill="${color}" />
      <circle cx="21" cy="20" r="10.5" fill="#ffffff" />
    </svg>
  `
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(38, 46),
    anchor: new google.maps.Point(19, 45),
    labelOrigin: new google.maps.Point(19, 18),
  }
}

function markerLabel(checkpoint: JourneyCheckpoint, stopIndex: number) {
  if (checkpoint.kind === "start") return "S"
  if (checkpoint.kind === "end") return "E"
  return String(stopIndex)
}

function RunJourneyMap({ journey }: { journey: RunJourney }) {
  const [mapElement, setMapElement] = React.useState<HTMLDivElement | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const mappedCheckpoints = React.useMemo(
    () => journey.checkpoints.filter((checkpoint) => checkpoint.position !== null),
    [journey.checkpoints]
  )

  React.useEffect(() => {
    if (!mapElement || (journey.path.length === 0 && mappedCheckpoints.length === 0)) return
    let cancelled = false
    let resizeObserver: ResizeObserver | null = null
    let resizeFrame: number | null = null
    let polyline: google.maps.Polyline | null = null
    let markers: google.maps.Marker[] = []
    setLoading(true)
    setError(null)

    loadGoogleMaps([]).then(() => {
      if (cancelled) return
      const firstPosition = journey.path[0] ?? mappedCheckpoints[0].position!
      const map = new google.maps.Map(mapElement, {
        center: firstPosition,
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
      })
      const bounds = new google.maps.LatLngBounds()
      journey.path.forEach((point) => bounds.extend(point))
      if (journey.path.length > 1) {
        polyline = new google.maps.Polyline({
          map,
          path: journey.path,
          strokeColor: "#2563eb",
          strokeOpacity: 0.9,
          strokeWeight: 4,
        })
      }

      markers = mappedCheckpoints.map((checkpoint) => {
        const checkpointIndex = journey.checkpoints.findIndex((candidate) => candidate.key === checkpoint.key)
        const stopNumber = journey.checkpoints
          .slice(0, checkpointIndex + 1)
          .filter((candidate) => candidate.kind === "stop").length
        const label = markerLabel(checkpoint, stopNumber)
        const marker = new google.maps.Marker({
          map,
          position: checkpoint.position!,
          title: `${label}. ${checkpoint.label} · ${formatKm(checkpoint.segmentKm)} from previous`,
          icon: markerIcon(checkpoint),
          label: { text: label, color: "#111827", fontSize: "12px", fontWeight: "700" },
          zIndex: checkpoint.isShipmentStop ? 500 : 1,
        })
        bounds.extend(checkpoint.position!)
        return marker
      })

      const refreshMap = () => {
        google.maps.event.trigger(map, "resize")
        if (bounds.isEmpty()) return
        map.fitBounds(bounds, 48)
      }
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = window.requestAnimationFrame(() => {
          if (cancelled) return
          refreshMap()
          setLoading(false)
        })
      })
      resizeObserver = new ResizeObserver(() => {
        if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
        resizeFrame = window.requestAnimationFrame(refreshMap)
      })
      resizeObserver.observe(mapElement)
    }).catch(() => {
      if (!cancelled) {
        setError("The map could not be loaded. Check the Google Maps configuration and try again.")
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      resizeObserver?.disconnect()
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame)
      markers.forEach((marker) => marker.setMap(null))
      polyline?.setMap(null)
    }
  }, [journey.checkpoints, journey.path, mapElement, mappedCheckpoints])

  if (journey.path.length === 0 && mappedCheckpoints.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
        No coordinates were recorded for this run.
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-72 items-center justify-center rounded-lg border border-dashed px-6 text-center text-sm text-muted-foreground">
        {error}
      </div>
    )
  }

  return (
    <div className="relative">
      <div ref={setMapElement} className="h-[420px] w-full rounded-lg" aria-label="Run stops and travelled route map" />
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/80 text-sm text-muted-foreground">
          Loading map…
        </div>
      ) : null}
    </div>
  )
}

function distanceExplanation(method: RunJourney["distanceMethod"]) {
  if (method === "odometer") {
    return "Leg and cumulative KM use the odometer readings captured at each stop."
  }
  if (method === "allocated") {
    return "The run's odometer total is allocated to each leg using its share of the recorded GPS route, so the final cumulative KM reconciles to the run total."
  }
  if (method === "gps") {
    return "Leg and cumulative KM are calculated from the recorded GPS route."
  }
  return "There is not enough distance data to calculate KM between stops."
}

export function RunStopJourney({ run }: { run: Run }) {
  const journey = React.useMemo(() => buildRunJourney(run), [run])

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Run route and stops</CardTitle>
          <CardDescription>
            Green marks the run start, blue marks other stops, amber highlights shipment pickup/drop-off stops, and black marks the run end.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RunJourneyMap journey={journey} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stop-by-stop distance</CardTitle>
          <CardDescription>{distanceExplanation(journey.distanceMethod)}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="min-w-[1120px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Stop</TableHead>
                  <TableHead className="w-40">Location type</TableHead>
                  <TableHead className="w-56">Purpose</TableHead>
                  <TableHead className="w-44">Arrived</TableHead>
                  <TableHead className="w-44">Departed</TableHead>
                  <TableHead className="w-36 text-right">KM from previous</TableHead>
                  <TableHead className="w-32 text-right">Cumulative KM</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {journey.checkpoints.map((checkpoint, checkpointIndex) => {
                  const stopNumber = journey.checkpoints
                    .slice(0, checkpointIndex + 1)
                    .filter((candidate) => candidate.kind === "stop").length
                  const sequence = markerLabel(checkpoint, stopNumber)
                  const subtitle = locationSubtitle(checkpoint.location)
                  const eventTypes = [...new Set(checkpoint.activities.map((activity) => activity.event_type).filter(Boolean))]
                  return (
                    <TableRow
                      key={checkpoint.key}
                      className={cn(checkpoint.isShipmentStop && "bg-amber-50/70 hover:bg-amber-50 dark:bg-amber-950/20 dark:hover:bg-amber-950/30")}
                    >
                      <TableCell className="font-semibold">{sequence}</TableCell>
                      <TableCell>
                        <p className="font-medium">{checkpoint.label}</p>
                        {subtitle && subtitle !== checkpoint.label ? (
                          <p className="mt-1 max-w-sm text-xs text-muted-foreground">{subtitle}</p>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {checkpoint.location?.type?.title || "Unmapped stop"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1.5">
                          {checkpoint.kind === "start" ? <Badge variant="secondary">Run start</Badge> : null}
                          {checkpoint.kind === "end" ? <Badge variant="secondary">Run end</Badge> : null}
                          {checkpoint.shipmentRoles.map((role) => (
                            <Badge key={role.key} className="bg-amber-600 text-white hover:bg-amber-600">
                              {role.role}
                            </Badge>
                          ))}
                          {checkpoint.kind === "stop" && checkpoint.shipmentRoles.length === 0
                            ? eventTypes.map((type) => <Badge key={type} variant="secondary">{eventLabel(type)}</Badge>)
                            : null}
                        </div>
                        {checkpoint.shipmentRoles.length > 0 ? (
                          <div className="mt-2 space-y-1">
                            {[...new Map(checkpoint.shipmentRoles.map((role) => [role.shipmentId, role])).values()].map((role) => (
                              <Link
                                key={role.shipmentId}
                                href={AdminRoute.shipmentDetails(role.shipmentId)}
                                className="block text-xs font-medium text-primary underline-offset-4 hover:underline"
                              >
                                {role.reference}
                              </Link>
                            ))}
                          </div>
                        ) : null}
                      </TableCell>
                      <TableCell>{formatDateTime(checkpoint.arrivedAt)}</TableCell>
                      <TableCell>{formatDateTime(checkpoint.departedAt)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {checkpoint.kind === "start" ? "—" : formatKm(checkpoint.segmentKm)}
                      </TableCell>
                      <TableCell className="text-right font-medium">{formatKm(checkpoint.cumulativeKm)}</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={7} className="text-right">Run total</TableCell>
                  <TableCell className="text-right">{formatKm(journey.totalKm)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
