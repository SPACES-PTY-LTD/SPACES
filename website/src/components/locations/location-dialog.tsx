"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { createLocation, updateLocation } from "@/lib/api/locations"
import type { LocationPayload } from "@/lib/api/locations"
import { listLocationTypes } from "@/lib/api/location-types"
import type { Location, LocationType } from "@/lib/types"
import {
  PlacesSuggestions,
  type PlaceSelection,
} from "@/components/locations/places-suggestions"

type FormState = {
  locationTypeId: string
  name: string
  code: string
  company: string
  addressLine1: string
  addressLine2: string
  town: string
  city: string
  country: string
  firstName: string
  lastName: string
  phone: string
  province: string
  postCode: string
  latitude: string
  longitude: string
  googlePlaceId: string
  polygonBounds: string
}

function parseNumber(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = Number(trimmed)
  return Number.isNaN(parsed) ? null : parsed
}

function parsePolygonBounds(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const parsed = JSON.parse(trimmed)
    if (!Array.isArray(parsed)) return null
    return parsed as number[][]
  } catch {
    return null
  }
}

export function LocationDialog({
  location,
  merchantId,
  accessToken,
  onSaved,
  trigger,
}: {
  location?: Location
  merchantId?: string | null
  accessToken?: string
  onSaved?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const { data: session } = useSession()
  const selectedMerchantId = session?.selected_merchant?.merchant_id ?? null
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [locationTypes, setLocationTypes] = React.useState<LocationType[]>([])
  const [locationTypesLoading, setLocationTypesLoading] = React.useState(false)
  const [values, setValues] = React.useState<FormState>({
    locationTypeId: location?.location_type_id ?? location?.type?.location_type_id ?? "",
    name: location?.name ?? "",
    code: location?.code ?? "",
    company: location?.company ?? "",
    addressLine1: location?.address_line_1 ?? "",
    addressLine2: location?.address_line_2 ?? "",
    town: location?.town ?? "",
    city: location?.city ?? "",
    country: location?.country ?? "",
    firstName: location?.first_name ?? "",
    lastName: location?.last_name ?? "",
    phone: location?.phone ?? "",
    province: location?.province ?? "",
    postCode: location?.post_code ?? "",
    latitude: String(location?.latitude) ?? "",
    longitude: String(location?.longitude) ?? "",
    googlePlaceId: location?.google_place_id ?? "",
    polygonBounds: location?.polygon_bounds
      ? JSON.stringify(location.polygon_bounds)
      : "",
  })

  const isEdit = Boolean(location)

  React.useEffect(() => {
    if (!open) return
    setValues({
      locationTypeId: location?.location_type_id ?? location?.type?.location_type_id ?? "",
      name: location?.name ?? "",
      code: location?.code ?? "",
      company: location?.company ?? "",
      addressLine1: location?.address_line_1 ?? "",
      addressLine2: location?.address_line_2 ?? "",
      town: location?.town ?? "",
      city: location?.city ?? "",
      country: location?.country ?? "",
      firstName: location?.first_name ?? "",
      lastName: location?.last_name ?? "",
      phone: location?.phone ?? "",
      province: location?.province ?? "",
      postCode: location?.post_code ?? "",
      latitude: String(location?.latitude ?? ""),
      longitude: String(location?.longitude ?? ""),
      googlePlaceId: location?.google_place_id ?? "",
      polygonBounds: location?.polygon_bounds
        ? JSON.stringify(location.polygon_bounds)
        : "",
    })
  }, [open, location])

  React.useEffect(() => {
    if (!open) return
    const activeMerchantId = selectedMerchantId ?? merchantId ?? null
    if (!activeMerchantId) return

    let ignore = false
    async function loadTypes() {
      setLocationTypesLoading(true)
      const response = await listLocationTypes(accessToken, {
        merchant_id: String(activeMerchantId),
      })
      if (ignore) return
      if (isApiErrorResponse(response)) {
        toast.error(response.message || "Failed to load location types.")
        setLocationTypes([])
        setLocationTypesLoading(false)
        return
      }
      setLocationTypes(response.data ?? [])
      setLocationTypesLoading(false)
    }

    loadTypes()
    return () => {
      ignore = true
    }
  }, [accessToken, merchantId, open, selectedMerchantId])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handlePlaceChange = (selection: PlaceSelection) => {
    setValues((prev) => ({
      ...prev,
      name: prev.name || selection.name,
      addressLine1: selection.addressLine1 || prev.addressLine1,
      addressLine2: selection.addressLine2 || prev.addressLine2,
      town: selection.town || prev.town,
      city: selection.city || prev.city,
      province: selection.province || prev.province,
      postCode: selection.postCode || prev.postCode,
      country: selection.country || prev.country,
      latitude:
        typeof selection.latitude === "number"
          ? String(selection.latitude)
          : prev.latitude,
      longitude:
        typeof selection.longitude === "number"
          ? String(selection.longitude)
          : prev.longitude,
      googlePlaceId: selection.googlePlaceId || prev.googlePlaceId,
    }))
  }

  const handleSubmit = async () => {
    if (!values.name) {
      toast.error("Name is required.")
      return
    }
    if (!values.addressLine1) {
      toast.error("Address line 1 is required.")
      return
    }
    if (!values.locationTypeId) {
      toast.error("Location type is required.")
      return
    }
    setLoading(true)
    try {
      const polygonBounds = parsePolygonBounds(values.polygonBounds)
      if (values.polygonBounds.trim() && !polygonBounds) {
        toast.error("Polygon bounds must be valid JSON.")
        setLoading(false)
        return
      }
      const payloadMerchantId = selectedMerchantId ?? merchantId ?? null
      const payload: LocationPayload = {
        location_type_id: values.locationTypeId,
        name: values.name,
        code: values.code || null,
        company: values.company || null,
        address_line_1: values.addressLine1 || null,
        address_line_2: values.addressLine2 || null,
        town: values.town || null,
        city: values.city || null,
        country: values.country || null,
        first_name: values.firstName || null,
        last_name: values.lastName || null,
        phone: values.phone || null,
        province: values.province || null,
        post_code: values.postCode || null,
        latitude: parseNumber(values.latitude),
        longitude: parseNumber(values.longitude),
        google_place_id: values.googlePlaceId || null,
        polygon_bounds: polygonBounds,
      }
      if (payloadMerchantId) {
        payload.merchant_id = payloadMerchantId
      }

      if (isEdit) {
        if (!location?.location_id) {
          toast.error("Missing location id.")
          setLoading(false)
          return
        }
        const result = await updateLocation(
          location.location_id,
          payload,
          accessToken
        )
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }
        toast.success("Location updated.")
      } else {
        const result = await createLocation(payload, accessToken)
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }
        toast.success("Location created.")
      }

      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save location.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant={isEdit ? "outline" : "default"}>
            {isEdit ? "Edit location" : "New location"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit location" : "Create location"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update location details." : "Add a pickup or dropoff location."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Location type</label>
            <Select
              value={values.locationTypeId}
              onValueChange={(value) => updateValue("locationTypeId", value)}
              disabled={locationTypesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={locationTypesLoading ? "Loading location types..." : "Select location type"}
                />
              </SelectTrigger>
              <SelectContent>
                {locationTypes.map((type) => {
                  if (!type.location_type_id) return null
                  return (
                    <SelectItem key={type.location_type_id} value={type.location_type_id}>
                      {type.title || type.slug || type.location_type_id}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Name</label>
              <Input
                value={values.name}
                onChange={(event) => updateValue("name", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Code</label>
              <Input
                value={values.code}
                onChange={(event) => updateValue("code", event.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Company</label>
            <Input
              value={values.company}
              onChange={(event) => updateValue("company", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Search address</label>
            <PlacesSuggestions
              onChange={handlePlaceChange}
              resetKey={open}
              countryCode="za"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Address line 1</label>
            <Input
              value={values.addressLine1}
              onChange={(event) => updateValue("addressLine1", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Address line 2</label>
            <Input
              value={values.addressLine2}
              onChange={(event) => updateValue("addressLine2", event.target.value)}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Town</label>
              <Input
                value={values.town}
                onChange={(event) => updateValue("town", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">City</label>
              <Input
                value={values.city}
                onChange={(event) => updateValue("city", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Province</label>
              <Input
                value={values.province}
                onChange={(event) => updateValue("province", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Postal code</label>
              <Input
                value={values.postCode}
                onChange={(event) => updateValue("postCode", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Country</label>
              <Input
                value={values.country}
                onChange={(event) => updateValue("country", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Phone</label>
              <Input
                value={values.phone}
                onChange={(event) => updateValue("phone", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">First name</label>
              <Input
                value={values.firstName}
                onChange={(event) => updateValue("firstName", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Last name</label>
              <Input
                value={values.lastName}
                onChange={(event) => updateValue("lastName", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Latitude</label>
              <Input
                value={values.latitude}
                onChange={(event) => updateValue("latitude", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Longitude</label>
              <Input
                value={values.longitude}
                onChange={(event) => updateValue("longitude", event.target.value)}
              />
            </div>
          </div>
   
          
    


        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save changes" : "Create location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
