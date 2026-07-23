"use client"

import * as React from "react"
import { AlertTriangle, Check, ChevronsUpDown, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { LocationTruckActivityTimelineCard } from "@/components/locations/location-truck-activity-timeline-card"
import { VehicleActivityTimelineCard } from "@/components/vehicles/vehicle-activity-timeline-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { runAutorunTest, type AutorunTestResult } from "@/lib/api/autorun-test"
import { listLocations } from "@/lib/api/locations"
import { getMerchantLocationAutomation, type MerchantLocationAutomation } from "@/lib/api/location-automation"
import { listVehicles } from "@/lib/api/vehicles"
import { cn } from "@/lib/utils"
import type { Location, LocationAutomationAction, Vehicle } from "@/lib/types"

const actionLabels: Record<string, string> = {
  record_vehicle_entry: "Record vehicle entry",
  record_vehicle_exit: "Record vehicle exit",
  start_run: "End run & start new run",
  create_shipment: "Create shipment",
}

function SearchPicker<T>({
  label,
  placeholder,
  searchPlaceholder,
  value,
  options,
  loading,
  getId,
  getLabel,
  onOpenChange,
  onSearch,
  onChange,
  disabled,
}: {
  label: string
  placeholder: string
  searchPlaceholder: string
  value: T | null
  options: T[]
  loading: boolean
  getId: (item: T) => string
  getLabel: (item: T) => string
  onOpenChange: (open: boolean) => void
  onSearch: (query: string) => void
  onChange: (item: T) => void
  disabled?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selectedId = value ? getId(value) : null

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          onOpenChange(next)
        }}
      >
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" role="combobox" disabled={disabled} className="w-full justify-between font-normal">
            <span className={cn("truncate", !value && "text-muted-foreground")}>{value ? getLabel(value) : placeholder}</span>
            <ChevronsUpDown className="ml-2 size-4 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder={searchPlaceholder} onValueChange={onSearch} />
            <CommandList>
              <CommandEmpty>{loading ? "Loading..." : "No results found."}</CommandEmpty>
              {options.map((item) => (
                <CommandItem key={getId(item)} value={getId(item)} onSelect={() => { onChange(item); setOpen(false) }}>
                  <Check className={cn("size-4", selectedId === getId(item) ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{getLabel(item)}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  )
}

export function AutorunTestTool({ accessToken, merchantId, merchantName }: { accessToken: string; merchantId: string | null; merchantName: string | null }) {
  const [location, setLocation] = React.useState<Location | null>(null)
  const [vehicle, setVehicle] = React.useState<Vehicle | null>(null)
  const [locations, setLocations] = React.useState<Location[]>([])
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([])
  const [locationQuery, setLocationQuery] = React.useState("")
  const [vehicleQuery, setVehicleQuery] = React.useState("")
  const [locationOpen, setLocationOpen] = React.useState(false)
  const [vehicleOpen, setVehicleOpen] = React.useState(false)
  const [locationsLoading, setLocationsLoading] = React.useState(false)
  const [vehiclesLoading, setVehiclesLoading] = React.useState(false)
  const [processing, setProcessing] = React.useState(false)
  const [action, setAction] = React.useState<"enter" | "exit">("enter")
  const [result, setResult] = React.useState<AutorunTestResult | null>(null)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [automation, setAutomation] = React.useState<MerchantLocationAutomation | null>(null)
  const [automationLoading, setAutomationLoading] = React.useState(false)

  React.useEffect(() => {
    if (!merchantId) {
      setAutomation(null)
      return
    }

    let cancelled = false
    setAutomationLoading(true)
    getMerchantLocationAutomation(merchantId, accessToken).then((response) => {
      if (cancelled) return
      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to load location automation actions.")
        setAutomation(null)
      } else {
        setAutomation(response)
      }
      setAutomationLoading(false)
    })

    return () => { cancelled = true }
  }, [accessToken, merchantId])

  React.useEffect(() => {
    if (!locationOpen || !merchantId) return
    const timer = window.setTimeout(async () => {
      setLocationsLoading(true)
      const response = await listLocations(accessToken, { merchant_id: merchantId, search: locationQuery || undefined, per_page: 50, geofence_status: "with" })
      if (isApiErrorResponse(response)) toast.error(response.message)
      else setLocations(response.data ?? [])
      setLocationsLoading(false)
    }, locationQuery ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [accessToken, locationOpen, locationQuery, merchantId])

  React.useEffect(() => {
    if (!vehicleOpen || !merchantId) return
    const timer = window.setTimeout(async () => {
      setVehiclesLoading(true)
      const response = await listVehicles(accessToken, { merchant_id: merchantId, search: vehicleQuery || undefined, per_page: 50 })
      if (isApiErrorResponse(response)) toast.error(response.message)
      else setVehicles(response.data ?? [])
      setVehiclesLoading(false)
    }, vehicleQuery ? 250 : 0)
    return () => window.clearTimeout(timer)
  }, [accessToken, merchantId, vehicleOpen, vehicleQuery])

  const process = async () => {
    if (!merchantId || !vehicle?.vehicle_id || !location?.location_id) return
    const confirmed = window.confirm(`This will process a real location ${action} and may update runs, shipments, bookings, and activities. Continue?`)
    if (!confirmed) return
    setProcessing(true)
    setResult(null)
    const response = await runAutorunTest({ merchant_id: merchantId, vehicle_id: vehicle.vehicle_id, location_id: location.location_id, action }, accessToken)
    setProcessing(false)
    if (isApiErrorResponse(response)) {
      toast.error(response.message || "Autorun lifecycle test failed.")
      return
    }
    setResult(response.data)
    setRefreshKey((current) => current + 1)
    toast.success("Autorun lifecycle processed.")
  }

  const locationHasGeometry = Boolean(location && ((location.latitude != null && location.longitude != null) || (location.polygon_bounds?.length ?? 0) >= 3))
  const effectiveActions = React.useMemo(() => {
    if (!location?.type?.location_type_id) return null
    const configured = automation?.location_types.find((rule) => rule.location_type_id === location.type?.location_type_id)
    if (configured) return { entry: configured.entry, exit: configured.exit, source: "Configured" as const }

    const entry: LocationAutomationAction[] = [
      { id: "fallback-entry-record", action: "record_vehicle_entry", conditions: [] },
      ...(location.type.collection_point ? [{ id: "fallback-entry-start-run", action: "start_run" as const, conditions: [] }] : []),
      ...(location.type.delivery_point ? [{ id: "fallback-entry-create-shipment", action: "create_shipment" as const, conditions: [] }] : []),
    ]
    return {
      entry,
      exit: [{ id: "fallback-exit-record", action: "record_vehicle_exit", conditions: [] }],
      source: "System fallback" as const,
    }
  }, [automation, location])

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <Card>
        <CardHeader><CardTitle>Process position</CardTitle><CardDescription>Run the lifecycle for the selected merchant{merchantName ? `: ${merchantName}` : "."}</CardDescription></CardHeader>
        <CardContent className="space-y-5">
          {!merchantId ? <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">Select a merchant before using this tool.</div> : null}
          <div className="space-y-2">
            <Label>Action</Label>
            <Select value={action} onValueChange={(value) => { setAction(value as "enter" | "exit"); setResult(null) }} disabled={processing}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="enter">Enter location</SelectItem>
                <SelectItem value="exit">Exit location</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SearchPicker label="Location" placeholder="Select a location" searchPlaceholder="Search locations..." value={location} options={locations} loading={locationsLoading} getId={(item) => item.location_id} getLabel={(item) => item.name || item.code || item.full_address || "Unnamed location"} onOpenChange={setLocationOpen} onSearch={setLocationQuery} onChange={(item) => { setLocation(item); setResult(null) }} disabled={!merchantId || processing} />
          {location ? (
            <div className="-mt-3 space-y-3 rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div>
                <span className="text-muted-foreground">Location type: </span>
                <span className="font-medium">{location.type?.title || "Not assigned"}</span>
              </div>
              {location.type ? (
                automationLoading ? <p className="text-muted-foreground">Loading automatic actions...</p> : effectiveActions ? (
                  <div className="space-y-2 border-t pt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">Automatic actions</span>
                      <span className={cn("text-xs", automation?.enabled ? "text-muted-foreground" : "font-medium text-amber-700")}>
                        {automation?.enabled ? effectiveActions.source : "Automation disabled"}
                      </span>
                    </div>
                    {(["entry", "exit"] as const).map((event) => (
                      <div key={event} className="grid grid-cols-[3rem_1fr] gap-2">
                        <span className="text-xs font-medium uppercase text-muted-foreground">{event}</span>
                        <div className="flex flex-wrap gap-1.5">
                          {effectiveActions[event].length > 0 ? effectiveActions[event].map((action, index) => (
                            <span key={action.id || `${event}-${index}`} className="rounded-full border bg-background px-2 py-0.5 text-xs">
                              {actionLabels[action.action] ?? action.action}
                              {action.conditions.length > 0 ? ` (${action.conditions.length} condition${action.conditions.length === 1 ? "" : "s"})` : ""}
                            </span>
                          )) : <span className="text-xs text-muted-foreground">No actions</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null
              ) : null}
            </div>
          ) : null}
          {action === "enter" && location && !locationHasGeometry ? <p className="text-sm text-destructive">This location has no usable point or polygon geometry.</p> : null}
          <SearchPicker label="Truck" placeholder="Select a truck" searchPlaceholder="Search trucks..." value={vehicle} options={vehicles} loading={vehiclesLoading} getId={(item) => item.vehicle_id ?? item.vehicle_uuid ?? ""} getLabel={(item) => item.plate_number || item.ref_code || `${item.make ?? ""} ${item.model ?? ""}`.trim() || "Unnamed truck"} onOpenChange={setVehicleOpen} onSearch={setVehicleQuery} onChange={(item) => { setVehicle(item); setResult(null) }} disabled={!merchantId || processing} />
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm"><div className="flex gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><span>This commits the same side effects as live vehicle tracking. You will be asked to confirm.</span></div></div>
          <Button className="w-full" disabled={!merchantId || !vehicle?.vehicle_id || (action === "enter" && !locationHasGeometry) || !location || processing} onClick={process}>{processing ? <><Loader2 className="size-4 animate-spin" />Processing...</> : "Process"}</Button>
          {result ? <div className={cn("space-y-1 rounded-md border p-3 text-sm", result.location_mismatch && "border-amber-500/50 bg-amber-500/10")}><p className="font-medium">Processed {result.action === "enter" ? "entry" : "exit"} {new Date(result.processed_at).toLocaleString()}</p><p>Inside geofence: {result.inside_geofence ? "Yes" : "No"}</p>{result.simulated_coordinates.latitude != null && result.simulated_coordinates.longitude != null ? <p>Coordinates: {result.simulated_coordinates.latitude.toFixed(6)}, {result.simulated_coordinates.longitude.toFixed(6)}</p> : null}<p>Resolved location: {result.resolved_location?.name || result.resolved_location?.code || "None"}</p>{result.location_mismatch ? <p className="font-medium text-amber-700">Warning: normal geofence resolution selected a different overlapping location.</p> : null}</div> : null}
        </CardContent>
      </Card>
      <div>{merchantId ? <LocationTruckActivityTimelineCard key={`all-${refreshKey}`} merchantId={merchantId} accessToken={accessToken} title="All truck activity" /> : <Card><CardHeader><CardTitle>All truck activity</CardTitle><CardDescription>Select a merchant to view its truck activity.</CardDescription></CardHeader></Card>}</div>
      <div>{vehicle?.vehicle_id ? <VehicleActivityTimelineCard key={`${vehicle.vehicle_id}-${refreshKey}`} vehicleId={vehicle.vehicle_id} merchantId={merchantId ?? undefined} accessToken={accessToken} /> : <Card><CardHeader><CardTitle>Latest vehicle activities</CardTitle><CardDescription>Select a truck to view its activity.</CardDescription></CardHeader></Card>}</div>
    </div>
  )
}
