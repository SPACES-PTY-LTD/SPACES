"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  PlacesSuggestions,
  type PlaceSelection,
} from "@/components/locations/places-suggestions"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Location, ShipmentParcelInput } from "@/lib/types"

const emptyParcel = (): ShipmentParcelInput => ({
  title: "",
  weight_kg: 1,
  length_cm: 10,
  width_cm: 10,
  height_cm: 10,
})

export type ShipmentQuoteFormValues = {
  merchantId: string
  merchantOrderRef?: string
  deliveryNoteNumber?: string
  invoiceInvoiceNumber?: string
  invoicedAt?: string
  collectionDate: string
  pickupLocation: Location
  dropoffLocation: Location
  parcels: ShipmentParcelInput[]
}

export function ShipmentQuoteDialog({
  merchantId,
  title,
  description,
  triggerLabel,
  includeOrderRef = false,
  includeInvoicedAt = true,
  initialValues,
  submitLabel,
  trigger,
  onSubmit,
}: {
  merchantId?: string
  title: string
  description?: string
  triggerLabel: string
  includeOrderRef?: boolean
  includeInvoicedAt?: boolean
  initialValues?: Partial<ShipmentQuoteFormValues>
  submitLabel?: string
  trigger?: React.ReactElement
  onSubmit: (values: ShipmentQuoteFormValues) => Promise<unknown>
}) {
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [merchantOrderRef, setMerchantOrderRef] = React.useState("")
  const [deliveryNoteNumber, setDeliveryNoteNumber] = React.useState("")
  const [invoiceInvoiceNumber, setInvoiceInvoiceNumber] = React.useState("")
  const [invoicedAt, setInvoicedAt] = React.useState("")
  const [collectionDate, setCollectionDate] = React.useState("")
  const [pickupLocation, setPickupLocation] = React.useState<Location | null>(
    null
  )
  const [dropoffLocation, setDropoffLocation] = React.useState<Location | null>(
    null
  )
  const [addressResetKey, setAddressResetKey] = React.useState(0)
  const [parcels, setParcels] = React.useState<ShipmentParcelInput[]>([
    emptyParcel(),
  ])

  const resetForm = () => {
    setMerchantOrderRef(initialValues?.merchantOrderRef ?? "")
    setDeliveryNoteNumber(initialValues?.deliveryNoteNumber ?? "")
    setInvoiceInvoiceNumber(initialValues?.invoiceInvoiceNumber ?? "")
    setInvoicedAt(initialValues?.invoicedAt ? toDateTimeLocal(initialValues.invoicedAt) : "")
    setCollectionDate(initialValues?.collectionDate ? toDateTimeLocal(initialValues.collectionDate) : "")
    setPickupLocation(initialValues?.pickupLocation ?? null)
    setDropoffLocation(initialValues?.dropoffLocation ?? null)
    setAddressResetKey((prev) => prev + 1)
    setParcels(initialValues?.parcels?.length ? initialValues.parcels : [emptyParcel()])
    setError(null)
  }

  React.useEffect(() => {
    if (!open) return
    resetForm()
  }, [open])

  const mapPlaceToLocation = React.useCallback(
    (selection: PlaceSelection): Location => ({
      location_id: "",
      name: selection.name || selection.formattedAddress,
      address_line_1: selection.addressLine1,
      address_line_2: selection.addressLine2 || null,
      town: selection.town || null,
      city: selection.city || null,
      country: selection.country || null,
      province: selection.province || null,
      post_code: selection.postCode || null,
      latitude: selection.latitude ?? null,
      longitude: selection.longitude ?? null,
      google_place_id: selection.googlePlaceId || null,
    }),
    []
  )

  const updateParcel = (
    index: number,
    key: keyof ShipmentParcelInput,
    value: string
  ) => {
    setParcels((prev) =>
      prev.map((parcel, current) => {
        if (current !== index) return parcel
        if (
          key === "weight_kg" ||
          key === "length_cm" ||
          key === "width_cm" ||
          key === "height_cm"
        ) {
          const numeric = Number(value)
          return { ...parcel, [key]: Number.isFinite(numeric) ? numeric : 0 }
        }
        return { ...parcel, [key]: value }
      })
    )
  }

  const addParcel = () => {
    setParcels((prev) => [...prev, emptyParcel()])
  }

  const removeParcel = (index: number) => {
    setParcels((prev) =>
      prev.length === 1 ? prev : prev.filter((_, current) => current !== index)
    )
  }

  const toIsoDateTime = React.useCallback((value: string) => {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    return parsed.toISOString()
  }, [])

  const toDateTimeLocal = React.useCallback((value: string) => {
    if (!value) return ""
    const parsed = new Date(value)
    if (Number.isNaN(parsed.getTime())) return ""
    const pad = (part: number) => String(part).padStart(2, "0")
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  }, [])

  const getMinDateTimeLocal = React.useCallback(() => {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, "0")
    const year = now.getFullYear()
    const month = pad(now.getMonth() + 1)
    const day = pad(now.getDate())
    const hours = pad(now.getHours())
    const minutes = pad(now.getMinutes())
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }, [])

  const handleSubmit = async () => {
    setError(null)
    if (!merchantId) {
      setError("Select a merchant before creating this request.")
      return
    }
    if (!pickupLocation || !dropoffLocation) {
      setError("Add a pickup and dropoff address.")
      return
    }
    if (!collectionDate) {
      setError("Add a collection date.")
      return
    }
    const collectionDateIso = toIsoDateTime(collectionDate)
    if (!collectionDateIso) {
      setError("Collection date is invalid.")
      return
    }
    if (!initialValues && new Date(collectionDateIso).getTime() <= Date.now()) {
      setError("Collection date must be in the future.")
      return
    }
    const invoicedAtIso = includeInvoicedAt && invoicedAt ? toIsoDateTime(invoicedAt) : undefined
    if (includeInvoicedAt && invoicedAt && !invoicedAtIso) {
      setError("Invoiced at is invalid.")
      return
    }
    if (includeOrderRef && !merchantOrderRef) {
      setError("Add a merchant order reference.")
      return
    }
    if (parcels.some((parcel) => !parcel.title)) {
      setError("Each parcel needs a title.")
      return
    }

    setLoading(true)
    try {
      const result = await onSubmit({
        merchantId,
        merchantOrderRef: merchantOrderRef || undefined,
        deliveryNoteNumber: deliveryNoteNumber || undefined,
        invoiceInvoiceNumber: invoiceInvoiceNumber || undefined,
        invoicedAt: invoicedAtIso,
        collectionDate: collectionDateIso,
        pickupLocation,
        dropoffLocation,
        parcels,
      })
      if (isApiErrorResponse(result)) {
        setError(result.message)
        toast.error(result.message)
        return
      }
      setOpen(false)
      resetForm()
    } catch (err) {
      const message = err instanceof Error ? err.message : "Request failed."
      setError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? <Button disabled={!merchantId}>{triggerLabel}</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <div className="grid gap-4">
          {includeOrderRef ? (
            <div className="grid gap-2">
              <Label>Merchant order reference</Label>
              <Input
                placeholder=""
                value={merchantOrderRef}
                onChange={(event) => setMerchantOrderRef(event.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-2 md:grid-cols-2">
            <div className="grid gap-2">
              <Label>Delivery note number</Label>
              <Input
                value={deliveryNoteNumber}
                onChange={(event) => setDeliveryNoteNumber(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label>Invoice number</Label>
              <Input
                value={invoiceInvoiceNumber}
                onChange={(event) => setInvoiceInvoiceNumber(event.target.value)}
              />
            </div>
          </div>
          {includeInvoicedAt ? (
            <div className="grid gap-2">
              <Label>Invoiced at</Label>
              <Input
                type="datetime-local"
                value={invoicedAt}
                onChange={(event) => setInvoicedAt(event.target.value)}
              />
            </div>
          ) : null}
          <div className="grid gap-2">
            <Label>Collection date</Label>
            <Input
              type="datetime-local"
              min={getMinDateTimeLocal()}
              value={collectionDate}
              onChange={(event) => setCollectionDate(event.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Pickup address</Label>
            <PlacesSuggestions
              placeholder="Start typing pickup address"
              resetKey={addressResetKey}
              initialQuery={initialValues?.pickupLocation ? (initialValues.pickupLocation.full_address ?? initialValues.pickupLocation.address_line_1 ?? initialValues.pickupLocation.name ?? "") : ""}
              onChange={(selection) =>
                setPickupLocation(mapPlaceToLocation(selection))
              }
            />
          </div>
          <div className="grid gap-2">
            <Label>Dropoff address</Label>
            <PlacesSuggestions
              placeholder="Start typing dropoff address"
              resetKey={addressResetKey}
              initialQuery={initialValues?.dropoffLocation ? (initialValues.dropoffLocation.full_address ?? initialValues.dropoffLocation.address_line_1 ?? initialValues.dropoffLocation.name ?? "") : ""}
              onChange={(selection) =>
                setDropoffLocation(mapPlaceToLocation(selection))
              }
            />
          </div>
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Parcels</div>
              <Button type="button" variant="outline" size="sm" onClick={addParcel}>
                Add parcel
              </Button>
            </div>
            {parcels.map((parcel, index) => (
              <div key={index} className="rounded-lg border border-border/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">Parcel {index + 1}</div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeParcel(index)}
                    disabled={parcels.length === 1}
                  >
                    Remove
                  </Button>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="grid gap-2 md:col-span-2">
                    <Label>Title</Label>
                    <Input
                      placeholder=""
                      value={parcel.title}
                      onChange={(event) =>
                        updateParcel(index, "title", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Weight (kg)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={parcel.weight_kg}
                      onChange={(event) =>
                        updateParcel(index, "weight_kg", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Length (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={parcel.length_cm}
                      onChange={(event) =>
                        updateParcel(index, "length_cm", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Width (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={parcel.width_cm}
                      onChange={(event) =>
                        updateParcel(index, "width_cm", event.target.value)
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Height (cm)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.1"
                      value={parcel.height_cm}
                      onChange={(event) =>
                        updateParcel(index, "height_cm", event.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setOpen(false)
              resetForm()
            }}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : (submitLabel ?? triggerLabel)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
