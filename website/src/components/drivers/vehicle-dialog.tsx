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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicleTypes } from "@/lib/api/vehicle-types"
import {
  assignDriverVehicle,
  updateDriverVehicle,
} from "@/lib/api/driver-vehicles"
import { listVehicles } from "@/lib/api/vehicles"
import type { DriverVehicle, Vehicle, VehicleType } from "@/lib/types"

type FormState = {
  vehicleTypeId: string
  make: string
  model: string
  color: string
  plateNumber: string
  photoKey: string
}

export function VehicleDialog({
  driverId,
  vehicle,
  accessToken,
  merchantId,
  assignedVehicleIds,
  onSaved,
}: {
  driverId: string
  vehicle?: Vehicle
  accessToken?: string
  merchantId?: string
  assignedVehicleIds?: string[]
  onSaved?: () => void
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [loadingVehicles, setLoadingVehicles] = React.useState(false)
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([])
  const [availableVehicles, setAvailableVehicles] = React.useState<DriverVehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = React.useState("")
  const [values, setValues] = React.useState<FormState>({
    vehicleTypeId: vehicle?.type?.vehicle_type_id ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    color: vehicle?.color ?? "",
    plateNumber: vehicle?.plate_number ?? "",
    photoKey: vehicle?.photo_key ?? "",
  })

  const isEdit = Boolean(vehicle)

  React.useEffect(() => {
    if (!open) return
    let active = true
    if (!isEdit) return
    ;(async () => {
      try {
        const response = await listVehicleTypes(accessToken)
        if (!active) return
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          return
        }
        setVehicleTypes(response.data ?? [])
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load vehicle types."
        )
      }
    })()
    return () => {
      active = false
    }
  }, [open, accessToken, isEdit])

  React.useEffect(() => {
    if (!open || isEdit) return
    let active = true
    ;(async () => {
      setLoadingVehicles(true)
      try {
        const response = await listVehicles(accessToken, {
          page: 1,
          per_page: 100,
          merchant_id: merchantId,
        })
        if (!active) return
        if (isApiErrorResponse(response)) {
          toast.error(response.message)
          return
        }
        const assigned = new Set(
          (assignedVehicleIds ?? []).filter((vehicleId) => vehicleId.length > 0)
        )
        const nextVehicles = (response.data ?? []).filter((item) => {
          const vehicleId = item.vehicle_id ?? item.vehicle_uuid ?? item.driver_vehicle_id
          return Boolean(vehicleId) && !assigned.has(vehicleId ?? "")
        })
        setAvailableVehicles(nextVehicles)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to load available vehicles."
        )
      } finally {
        if (active) {
          setLoadingVehicles(false)
        }
      }
    })()

    return () => {
      active = false
    }
  }, [open, isEdit, accessToken, merchantId, assignedVehicleIds])

  React.useEffect(() => {
    if (!open) return
    setSelectedVehicleId("")
    setValues({
      vehicleTypeId: vehicle?.type?.vehicle_type_id ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      color: vehicle?.color ?? "",
      plateNumber: vehicle?.plate_number ?? "",
      photoKey: vehicle?.photo_key ?? "",
    })
  }, [open, vehicle])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (!isEdit) {
      if (!selectedVehicleId) {
        toast.error("Select a vehicle.")
        return
      }
      setLoading(true)
      try {
        const result = await assignDriverVehicle(
          driverId,
          { vehicle_id: selectedVehicleId },
          accessToken
        )
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }
        toast.success("Vehicle assigned.")
        setOpen(false)
        onSaved?.()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to assign vehicle.")
      } finally {
        setLoading(false)
      }
      return
    }

    if (
      !values.vehicleTypeId ||
      !values.make ||
      !values.model ||
      !values.color ||
      !values.plateNumber ||
      !values.photoKey
    ) {
      toast.error("Fill in all required fields.")
      return
    }
    setLoading(true)
    try {
      const payload = {
        vehicle_type_id: values.vehicleTypeId,
        make: values.make,
        model: values.model,
        color: values.color,
        plate_number: values.plateNumber,
        photo_key: values.photoKey,
      }
      const vehicleId =
        vehicle?.vehicle_uuid ??
        vehicle?.vehicle_id ??
        vehicle?.driver_vehicle_id
      if (!vehicleId) {
        toast.error("Missing vehicle id.")
        setLoading(false)
        return
      }
      const result = await updateDriverVehicle(vehicleId, payload, accessToken)
      if (isApiErrorResponse(result)) {
        toast.error(result.message)
        return
      }
      toast.success("Vehicle updated.")
      setOpen(false)
      onSaved?.()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save vehicle.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isEdit ? "outline" : "default"} size="sm">
          {isEdit ? "Edit" : "Add vehicle"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Add vehicle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update vehicle information."
              : "Select an existing vehicle to assign to this driver."}
          </DialogDescription>
        </DialogHeader>
        {isEdit ? (
          <div className="grid gap-4">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Vehicle type</label>
              <Select
                value={values.vehicleTypeId}
                onValueChange={(value) => updateValue("vehicleTypeId", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {vehicleTypes.map((vehicleType) => {
                    const vehicleTypeId = vehicleType.vehicle_type_id
                    if (!vehicleTypeId) return null
                    return (
                      <SelectItem key={vehicleTypeId} value={vehicleTypeId}>
                        {vehicleType.name}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Make</label>
                <Input
                  value={values.make}
                  onChange={(event) => updateValue("make", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Model</label>
                <Input
                  value={values.model}
                  onChange={(event) => updateValue("model", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Color</label>
                <Input
                  value={values.color}
                  onChange={(event) => updateValue("color", event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs text-muted-foreground">Plate number</label>
                <Input
                  value={values.plateNumber}
                  onChange={(event) =>
                    updateValue("plateNumber", event.target.value)
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Photo key</label>
              <Input
                value={values.photoKey}
                onChange={(event) => updateValue("photoKey", event.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Vehicle</label>
            <Select
              value={selectedVehicleId}
              onValueChange={setSelectedVehicleId}
              disabled={loadingVehicles || loading}
            >
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    loadingVehicles
                      ? "Loading vehicles..."
                      : availableVehicles.length > 0
                        ? "Select vehicle"
                        : "No available vehicles"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {availableVehicles.map((item) => {
                  const vehicleId =
                    item.vehicle_id ?? item.vehicle_uuid ?? item.driver_vehicle_id
                  if (!vehicleId) return null
                  const labelParts = [
                    item.plate_number,
                    [item.make, item.model].filter(Boolean).join(" "),
                  ].filter((part) => Boolean(part && part.trim().length > 0))
                  return (
                    <SelectItem key={vehicleId} value={vehicleId}>
                      {labelParts.length > 0 ? labelParts.join(" · ") : vehicleId}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Saving..." : isEdit ? "Save changes" : "Assign vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
