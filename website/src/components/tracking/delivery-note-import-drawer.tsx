"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command"
import {
  Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  analyzeDeliveryNote, confirmDeliveryNoteImport,
} from "@/lib/api/delivery-note-imports"
import { isApiErrorResponse } from "@/lib/api/client"
import { listLocations } from "@/lib/api/locations"
import { LocationDialog } from "@/components/locations/location-dialog"
import { formatAddress } from "@/lib/address"
import { cn } from "@/lib/utils"
import type {
  DeliveryNoteAddress, DeliveryNoteExtraction, DeliveryNoteLineItem, Location, Run,
} from "@/lib/types"

const parcelTypes = ["Box", "Pallet", "Envelope", "Bag", "Crate", "Drum"] as const

const normalize = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()

const addressKey = (address: DeliveryNoteAddress | Location) => [
  address.address_line_1, address.address_line_2, address.town, address.city,
  address.province, address.post_code, address.country,
].map(normalize).filter(Boolean).join("|")

function exactLocationMatch(address: DeliveryNoteAddress, locations: Location[]) {
  const key = addressKey(address)
  if (!key || !normalize(address.address_line_1) || !normalize(address.city)) return null
  const matches = locations.filter((location) => addressKey(location) === key)
  if (matches.length === 1) return matches[0]
  const name = normalize(address.name)
  return name ? matches.find((location) => normalize(location.name) === name) ?? null : null
}

const parcelTypeSelection = (value: string | null | undefined) =>
  parcelTypes.find((type) => normalize(type) === normalize(value)) ?? "Other"

const emptyAddress = (): DeliveryNoteAddress => ({
  name: "", company: "", address_line_1: "", address_line_2: "", town: "",
  city: "", province: "", post_code: "", country: "", first_name: "",
  last_name: "", phone: "",
})

const emptyLine = (): DeliveryNoteLineItem => ({
  merchant_order_ref: "", description: "", quantity: 1, type: "",
  weight: null, length_cm: null, width_cm: null, height_cm: null,
})

const emptyExtraction = (): DeliveryNoteExtraction => ({
  delivery_note_number: "", merchant_order_ref: "", collection_date: "",
  pickup_address: emptyAddress(), dropoff_address: emptyAddress(),
  pickup_instructions: "", dropoff_instructions: "", line_items: [emptyLine()],
})

export function DeliveryNoteImportDrawer({
  run, accessToken, open, onOpenChange, onConfirmed,
}: {
  run: Run
  accessToken: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirmed: (run: Run) => void
}) {
  const [file, setFile] = React.useState<File | null>(null)
  const [importId, setImportId] = React.useState("")
  const [data, setData] = React.useState<DeliveryNoteExtraction>(emptyExtraction)
  const [mode, setMode] = React.useState<"separate_shipments" | "single_shipment">("separate_shipments")
  const [analyzing, setAnalyzing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [locations, setLocations] = React.useState<Location[]>([])
  const [locationsLoading, setLocationsLoading] = React.useState(false)
  const [locationsError, setLocationsError] = React.useState("")
  const [pickupLocation, setPickupLocation] = React.useState<Location | null>(null)
  const [dropoffLocation, setDropoffLocation] = React.useState<Location | null>(null)
  const matchedImportRef = React.useRef("")

  const reset = React.useCallback(() => {
    setFile(null)
    setImportId("")
    setData(emptyExtraction())
    setMode("separate_shipments")
    setPickupLocation(null)
    setDropoffLocation(null)
    matchedImportRef.current = ""
  }, [])

  const loadLocations = React.useCallback(async () => {
    if (!run.merchant_id) return
    setLocationsLoading(true)
    setLocationsError("")
    const loaded: Location[] = []
    let page = 1
    let lastPage = 1
    do {
      const response = await listLocations(accessToken, {
        merchant_id: run.merchant_id,
        environment_id: run.environment_id ?? undefined,
        page,
        per_page: 100,
        sort_by: "name",
        sort_dir: "asc",
      })
      if (isApiErrorResponse(response)) {
        setLocationsError(response.message || "Failed to load locations.")
        setLocationsLoading(false)
        return
      }
      loaded.push(...(response.data ?? []))
      lastPage = Math.max(Number(response.meta?.last_page ?? 1), 1)
      page += 1
    } while (page <= lastPage)
    setLocations(Array.from(new Map(loaded.map((location) => [location.location_id, location])).values()))
    setLocationsLoading(false)
  }, [accessToken, run.environment_id, run.merchant_id])

  React.useEffect(() => {
    if (open) void loadLocations()
  }, [loadLocations, open])

  React.useEffect(() => {
    if (!importId || !locations.length || matchedImportRef.current === importId) return
    matchedImportRef.current = importId
    const pickup = exactLocationMatch(data.pickup_address, locations)
    const dropoff = exactLocationMatch(data.dropoff_address, locations)
    setPickupLocation(pickup)
    setDropoffLocation(dropoff)
    setData((current) => ({
      ...current,
      pickup_location_id: pickup?.location_id ?? null,
      dropoff_location_id: dropoff?.location_id ?? null,
    }))
  }, [data.dropoff_address, data.pickup_address, importId, locations])

  const setLine = (index: number, key: keyof DeliveryNoteLineItem, value: string) => {
    setData((current) => ({
      ...current,
      line_items: current.line_items.map((item, itemIndex) => itemIndex === index
        ? {
            ...item,
            [key]: ["quantity", "weight", "length_cm", "width_cm", "height_cm"].includes(key)
              ? (value === "" ? null : Number(value))
              : value,
          }
        : item),
    }))
  }

  const analyze = async () => {
    if (!file) return toast.error("Choose a delivery note first.")
    setAnalyzing(true)
    const response = await analyzeDeliveryNote(run.run_id, file, accessToken)
    setAnalyzing(false)
    if (isApiErrorResponse(response)) return toast.error(response.message)
    setImportId(response.data.import_id)
    setData({
      ...emptyExtraction(),
      ...response.data.extracted_data,
      pickup_address: { ...emptyAddress(), ...response.data.extracted_data?.pickup_address },
      dropoff_address: { ...emptyAddress(), ...response.data.extracted_data?.dropoff_address },
      line_items: response.data.extracted_data?.line_items?.length
        ? response.data.extracted_data.line_items
        : [emptyLine()],
      collection_date: response.data.extracted_data?.collection_date?.slice(0, 10) ?? "",
    })
  }

  const confirm = async () => {
    if (!data.pickup_location_id || !data.dropoff_location_id) {
      toast.error("Select or create both the pickup and drop-off locations.")
      return
    }
    setConfirming(true)
    const response = await confirmDeliveryNoteImport(
      run.run_id, importId, {
        ...data,
        pickup_address: undefined,
        dropoff_address: undefined,
        grouping_mode: mode,
      }, accessToken
    )
    setConfirming(false)
    if (isApiErrorResponse(response)) return toast.error(response.message)
    toast.success(`${response.data.shipment_ids.length} shipment(s) created and attached.`)
    onConfirmed(response.data.run)
    onOpenChange(false)
    reset()
  }

  return (
    <Drawer open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset() }}>
      <DrawerContent side="right" className="sm:w-[min(96vw,1100px)]">
        <DrawerHeader>
          <DrawerTitle>Upload Delivery Note</DrawerTitle>
          <DrawerDescription>
            AI extracts a draft only. Review all shipment information before confirming.
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {!importId ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Upload className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
              <Label htmlFor="delivery-note-file" className="text-base font-medium">Delivery note</Label>
              <p className="mb-4 text-sm text-muted-foreground">PDF, JPEG, PNG or WebP, up to 20 MB.</p>
              <Input
                id="delivery-note-file" type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Field label="Delivery note number" value={data.delivery_note_number ?? ""} onChange={(value) => setData({ ...data, delivery_note_number: value })} />
                <Field label="Collection / delivery date" type="date" value={data.collection_date ?? ""} onChange={(value) => setData({ ...data, collection_date: value })} />
                <div className="space-y-2">
                  <Label>Line-item grouping</Label>
                  <Select value={mode} onValueChange={(value) => setMode(value as typeof mode)}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate_shipments">Separate shipment per line item</SelectItem>
                      <SelectItem value="single_shipment">One shipment, line items as parcels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {mode === "single_shipment" ? (
                <Field label="Shipment reference" value={data.merchant_order_ref ?? ""} onChange={(value) => setData({ ...data, merchant_order_ref: value })} />
              ) : null}

              <div className="grid gap-6 lg:grid-cols-2">
                <DeliveryNoteLocationPicker
                  title="Origin / pickup"
                  value={pickupLocation}
                  locations={locations}
                  loading={locationsLoading}
                  error={locationsError}
                  draft={data.pickup_address}
                  merchantId={run.merchant_id}
                  accessToken={accessToken}
                  defaultLocationTypeSlug="pickup"
                  onRetry={() => void loadLocations()}
                  onChange={(location) => {
                    setPickupLocation(location)
                    setData((current) => ({ ...current, pickup_location_id: location.location_id }))
                  }}
                  onCreated={(location) => setLocations((current) => [location, ...current.filter((item) => item.location_id !== location.location_id)])}
                />
                <DeliveryNoteLocationPicker
                  title="Destination / drop-off"
                  value={dropoffLocation}
                  locations={locations}
                  loading={locationsLoading}
                  error={locationsError}
                  draft={data.dropoff_address}
                  merchantId={run.merchant_id}
                  accessToken={accessToken}
                  defaultLocationTypeSlug="dropoff"
                  onRetry={() => void loadLocations()}
                  onChange={(location) => {
                    setDropoffLocation(location)
                    setData((current) => ({ ...current, dropoff_location_id: location.location_id }))
                  }}
                  onCreated={(location) => setLocations((current) => [location, ...current.filter((item) => item.location_id !== location.location_id)])}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label>Pickup instructions</Label><Textarea value={data.pickup_instructions ?? ""} onChange={(event) => setData({ ...data, pickup_instructions: event.target.value })} /></div>
                <div className="space-y-2"><Label>Drop-off instructions</Label><Textarea value={data.dropoff_instructions ?? ""} onChange={(event) => setData({ ...data, dropoff_instructions: event.target.value })} /></div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Line items</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => setData({ ...data, line_items: [...data.line_items, emptyLine()] })}>
                    <Plus className="mr-2 h-4 w-4" />Add row
                  </Button>
                </div>
                <Table className="min-w-[1050px]">
                  <TableHeader><TableRow>
                    {mode === "separate_shipments" ? <TableHead className="w-44">Shipment reference</TableHead> : null}
                    <TableHead className="w-60">Description</TableHead><TableHead className="w-24">Qty</TableHead>
                    <TableHead className="w-32">Type</TableHead><TableHead className="w-28">Weight kg</TableHead>
                    <TableHead className="w-28">Length cm</TableHead><TableHead className="w-28">Width cm</TableHead>
                    <TableHead className="w-28">Height cm</TableHead><TableHead className="w-14" />
                  </TableRow></TableHeader>
                  <TableBody>{data.line_items.map((item, index) => (
                    <TableRow key={index}>
                      {mode === "separate_shipments" ? <TableCell><Input value={item.merchant_order_ref ?? ""} onChange={(e) => setLine(index, "merchant_order_ref", e.target.value)} /></TableCell> : null}
                      <TableCell><Input value={item.description ?? ""} onChange={(e) => setLine(index, "description", e.target.value)} /></TableCell>
                      <TableCell><Input type="number" min={1} value={item.quantity ?? ""} onChange={(e) => setLine(index, "quantity", e.target.value)} /></TableCell>
                      <TableCell className="space-y-2">
                        <Select value={parcelTypeSelection(item.type)} onValueChange={(value) => setLine(index, "type", value === "Other" ? "" : value)}>
                          <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {parcelTypes.map((type) => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        {parcelTypeSelection(item.type) === "Other" ? (
                          <Input placeholder="Custom type" value={item.type ?? ""} onChange={(e) => setLine(index, "type", e.target.value)} />
                        ) : null}
                      </TableCell>
                      {(["weight", "length_cm", "width_cm", "height_cm"] as const).map((key) => (
                        <TableCell key={key}><Input type="number" min={0} value={item[key] ?? ""} onChange={(e) => setLine(index, key, e.target.value)} /></TableCell>
                      ))}
                      <TableCell><Button type="button" size="icon" variant="ghost" disabled={data.line_items.length === 1} onClick={() => setData({ ...data, line_items: data.line_items.filter((_, i) => i !== index) })}><Trash2 className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            </>
          )}
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {!importId ? (
            <Button onClick={() => void analyze()} disabled={!file || analyzing}>
              {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {analyzing ? "Analyzing..." : "Upload and analyze"}
            </Button>
          ) : (
            <Button onClick={() => void confirm()} disabled={confirming}>
              {confirming ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {confirming ? "Creating shipments..." : "Create and attach shipments"}
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}

function DeliveryNoteLocationPicker({
  title, value, locations, loading, error, draft, merchantId, accessToken,
  defaultLocationTypeSlug, onRetry, onChange, onCreated,
}: {
  title: string
  value: Location | null
  locations: Location[]
  loading: boolean
  error: string
  draft: DeliveryNoteAddress
  merchantId?: string | null
  accessToken?: string
  defaultLocationTypeSlug: "pickup" | "dropoff"
  onRetry: () => void
  onChange: (location: Location) => void
  onCreated: (location: Location) => void
}) {
  const [open, setOpen] = React.useState(false)
  const selectedLabel = value?.name || value?.company || value?.code || formatAddress(value)
  const draftAddress = formatAddress(draft as Location)
  const initialValues = React.useMemo<Partial<Location>>(() => ({
    name: draft.name ?? undefined,
    company: draft.company ?? undefined,
    address_line_1: draft.address_line_1 ?? undefined,
    address_line_2: draft.address_line_2 ?? undefined,
    town: draft.town ?? undefined,
    city: draft.city ?? undefined,
    province: draft.province ?? undefined,
    post_code: draft.post_code ?? undefined,
    country: draft.country ?? undefined,
    first_name: draft.first_name ?? undefined,
    last_name: draft.last_name ?? undefined,
    phone: draft.phone ?? undefined,
  }), [draft])

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            disabled={loading || !merchantId}
            className="h-auto min-h-10 w-full justify-between whitespace-normal text-left font-normal"
          >
            <span className={cn("line-clamp-2", !selectedLabel && "text-muted-foreground")}>
              {loading ? "Loading locations..." : selectedLabel || "Select a location"}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search name, company, code or address..." />
            <CommandList className="max-h-72">
              <CommandEmpty>No locations found.</CommandEmpty>
              {locations.map((location) => {
                const label = location.name || location.company || location.code || formatAddress(location)
                const subtitle = formatAddress(location)
                return (
                  <CommandItem
                    key={location.location_id}
                    value={`${label} ${location.company ?? ""} ${location.code ?? ""} ${subtitle}`}
                    onSelect={() => { onChange(location); setOpen(false) }}
                    className="items-start"
                  >
                    <Check className={cn("mt-0.5 size-4 shrink-0", value?.location_id === location.location_id ? "opacity-100" : "opacity-0")} />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{label}</span>
                      {subtitle && subtitle !== label ? <span className="block truncate text-xs text-muted-foreground">{subtitle}</span> : null}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandList>
            <CommandSeparator />
            <div className="p-1">
              <LocationDialog
                merchantId={merchantId}
                lockMerchant
                accessToken={accessToken}
                initialValues={initialValues}
                defaultLocationTypeSlug={defaultLocationTypeSlug}
                onSaved={(location) => {
                  onCreated(location)
                  onChange(location)
                  setOpen(false)
                }}
                trigger={<Button type="button" variant="ghost" className="w-full justify-start"><Plus className="size-4" />Add new location</Button>}
              />
            </div>
          </Command>
        </PopoverContent>
      </Popover>
      {!value && draftAddress ? (
        <div className="rounded-md bg-muted p-3 text-sm">
          <p className="font-medium">AI-extracted address needs a location</p>
          <p className="mt-1 text-muted-foreground">{draft.name || draft.company ? `${draft.name || draft.company} — ` : ""}{draftAddress}</p>
        </div>
      ) : null}
      {error ? (
        <div className="flex items-center justify-between gap-2 text-sm text-destructive">
          <span>{error}</span>
          <Button type="button" size="sm" variant="outline" onClick={onRetry}><RefreshCw className="mr-2 size-3" />Retry</Button>
        </div>
      ) : null}
    </div>
  )
}

function Field({ label, value, onChange, type = "text" }: {
  label: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return <div className="space-y-2"><Label>{label}</Label><Input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></div>
}
