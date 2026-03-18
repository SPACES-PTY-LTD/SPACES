"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
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
import { LocationCombobox } from "@/components/locations/location-combobox"
import { isApiErrorResponse } from "@/lib/api/client"
import { createRoute, updateRoute, type RouteStopPayload } from "@/lib/api/routes"
import type { Route } from "@/lib/types"

type StopState = {
  location_id: string
  location_label?: string
}

function parseOptionalNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isFinite(parsed) ? parsed : null
}

export function RouteDialog({
  route,
  merchantId,
  lockMerchant = false,
  accessToken,
  onSaved,
}: {
  route?: Route
  merchantId?: string | null
  lockMerchant?: boolean
  accessToken?: string
  onSaved?: () => void
}) {
  const router = useRouter()
  const isEdit = Boolean(route?.route_id)
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [title, setTitle] = React.useState(route?.title ?? "")
  const [code, setCode] = React.useState(route?.code ?? "")
  const [description, setDescription] = React.useState(route?.description ?? "")
  const [estimatedDistance, setEstimatedDistance] = React.useState(
    route?.estimated_distance != null ? String(route.estimated_distance) : ""
  )
  const [estimatedDuration, setEstimatedDuration] = React.useState(
    route?.estimated_duration != null ? String(route.estimated_duration) : ""
  )
  const [estimatedCollectionTime, setEstimatedCollectionTime] = React.useState(
    route?.estimated_collection_time != null
      ? String(route.estimated_collection_time)
      : ""
  )
  const [estimatedDeliveryTime, setEstimatedDeliveryTime] = React.useState(
    route?.estimated_delivery_time != null ? String(route.estimated_delivery_time) : ""
  )
  const [merchantValue, setMerchantValue] = React.useState(merchantId ?? route?.merchant_id ?? "")
  const [stops, setStops] = React.useState<StopState[]>(
    (route?.stops ?? [])
      .slice()
      .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
      .map((stop) => ({
        location_id: stop.location?.location_id ?? stop.location_id ?? "",
        location_label:
          stop.location?.name ??
          stop.location?.company ??
          stop.location?.code ??
          stop.location?.location_id ??
          stop.location_id ??
          "",
      }))
  )

  React.useEffect(() => {
    if (!open) return
    setTitle(route?.title ?? "")
    setCode(route?.code ?? "")
    setDescription(route?.description ?? "")
    setEstimatedDistance(
      route?.estimated_distance != null ? String(route.estimated_distance) : ""
    )
    setEstimatedDuration(
      route?.estimated_duration != null ? String(route.estimated_duration) : ""
    )
    setEstimatedCollectionTime(
      route?.estimated_collection_time != null
        ? String(route.estimated_collection_time)
        : ""
    )
    setEstimatedDeliveryTime(
      route?.estimated_delivery_time != null ? String(route.estimated_delivery_time) : ""
    )
    setMerchantValue(merchantId ?? route?.merchant_id ?? "")
    setStops(
      (route?.stops ?? [])
        .slice()
        .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
        .map((stop) => ({
          location_id: stop.location?.location_id ?? stop.location_id ?? "",
          location_label:
            stop.location?.name ??
            stop.location?.company ??
            stop.location?.code ??
            stop.location?.location_id ??
            stop.location_id ??
            "",
        }))
    )
  }, [open, route, merchantId])

  const handleSubmit = async () => {
    const trimmedTitle = title.trim()
    const trimmedMerchantId = merchantValue.trim()
    if (!trimmedTitle) {
      toast.error("Title is required.")
      return
    }
    if (!trimmedMerchantId) {
      toast.error("Merchant ID is required.")
      return
    }

    const stopPayload: RouteStopPayload[] = stops
      .map((stop, index) => ({
        location_id: stop.location_id.trim(),
        sequence: index + 1,
      }))
      .filter((stop) => stop.location_id.length > 0)

    setLoading(true)
    try {
      const payload = {
        merchant_id: trimmedMerchantId,
        title: trimmedTitle,
        code: code.trim() || null,
        description: description.trim() || null,
        estimated_distance: parseOptionalNumber(estimatedDistance),
        estimated_duration: parseOptionalNumber(estimatedDuration),
        estimated_collection_time: parseOptionalNumber(estimatedCollectionTime),
        estimated_delivery_time: parseOptionalNumber(estimatedDeliveryTime),
        stops: stopPayload,
      }

      const result = isEdit && route?.route_id
        ? await updateRoute(route.route_id, payload, accessToken)
        : await createRoute(payload, accessToken)

      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }

      toast.success(isEdit ? "Route updated." : "Route created.")
      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save route.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "outline" : "default"}>
          {isEdit ? "Edit route" : "New route"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit route" : "Create route"}</DialogTitle>
          <DialogDescription>
            Manage route details and stop sequence.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(event) => setTitle(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Code</Label>
              <Input value={code} onChange={(event) => setCode(event.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Estimated distance (km)</Label>
              <Input
                type="number"
                step="0.01"
                value={estimatedDistance}
                onChange={(event) => setEstimatedDistance(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated duration (min)</Label>
              <Input
                type="number"
                step="1"
                value={estimatedDuration}
                onChange={(event) => setEstimatedDuration(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated collection time (min)</Label>
              <Input
                type="number"
                step="1"
                value={estimatedCollectionTime}
                onChange={(event) => setEstimatedCollectionTime(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Estimated delivery time (min)</Label>
              <Input
                type="number"
                step="1"
                value={estimatedDeliveryTime}
                onChange={(event) => setEstimatedDeliveryTime(event.target.value)}
              />
            </div>
          </div>



          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Stops</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setStops((prev) => [...prev, { location_id: "" }])}
              >
                Add location
              </Button>
            </div>
            {stops.length === 0 ? (
              <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                No stops added.
              </div>
            ) : (
              <div className="space-y-2">
                {stops.map((stop, index) => (
                  <div key={`${index}-${stop.location_id}`} className="grid grid-cols-[80px_1fr_auto] gap-2">
                    <Input value={String(index + 1)} disabled />
                    <LocationCombobox
                      value={stop.location_id}
                      selectedLabel={stop.location_label}
                      token={accessToken}
                      merchantId={merchantValue || merchantId || undefined}
                      onChange={(option) =>
                        setStops((prev) =>
                          prev.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  location_id: option.value,
                                  location_label: option.label,
                                }
                              : item
                          )
                        )
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setStops((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                      }
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save route" : "Create route"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
