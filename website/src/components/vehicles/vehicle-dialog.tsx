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
import { Switch } from "@/components/ui/switch"
import { listVehicleTypes } from "@/lib/api/vehicle-types"
import { createVehicle, updateVehicle } from "@/lib/api/vehicles"
import { isApiErrorResponse } from "@/lib/api/client"
import type { Vehicle, VehicleType } from "@/lib/types"

type FormState = {
  vehicleTypeId: string
  make: string
  model: string
  color: string
  plateNumber: string
  vinNumber: string
  engineNumber: string
  refCode: string
  isActive: "true" | "false"
}

export function VehicleDialog({
  vehicle,
  merchantId,
  accessToken,
  onSaved,
  trigger,
}: {
  vehicle?: Vehicle
  merchantId?: string | null
  accessToken?: string
  onSaved?: () => void
  trigger?: React.ReactElement
}) {
  const router = useRouter()
  const [open, setOpen] = React.useState(false)
  const [loading, setLoading] = React.useState(false)
  const [vehicleTypes, setVehicleTypes] = React.useState<VehicleType[]>([])
  const [values, setValues] = React.useState<FormState>({
    vehicleTypeId: vehicle?.type?.vehicle_type_id ?? "",
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    color: vehicle?.color ?? "",
    plateNumber: vehicle?.plate_number ?? "",
    vinNumber: vehicle?.vin_number ?? "",
    engineNumber: vehicle?.engine_number ?? "",
    refCode: vehicle?.ref_code ?? "",
    isActive: vehicle?.is_active === false ? "false" : "true",
  })

  const isEdit = Boolean(vehicle)

  React.useEffect(() => {
    if (!open) return
    let active = true
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
  }, [open, accessToken])

  React.useEffect(() => {
    if (!open) return
    setValues({
      vehicleTypeId: vehicle?.type?.vehicle_type_id ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      color: vehicle?.color ?? "",
      plateNumber: vehicle?.plate_number ?? "",
      vinNumber: vehicle?.vin_number ?? "",
      engineNumber: vehicle?.engine_number ?? "",
      refCode: vehicle?.ref_code ?? "",
      isActive: vehicle?.is_active === false ? "false" : "true",
    })
  }, [open, vehicle])

  const updateValue = (key: keyof FormState, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  const handleSubmit = async () => {
    if (
      !values.vehicleTypeId ||
      !values.make ||
      !values.model ||
      !values.color ||
      !values.plateNumber
    ) {
      toast.error("Fill in all required fields.")
      return
    }
    setLoading(true)
    try {
      const activeMerchantId = merchantId ?? vehicle?.merchant_id ?? null
      if (!activeMerchantId) {
        toast.error("Select a merchant before saving a vehicle.")
        setLoading(false)
        return
      }

      const payload = {
        vehicle_type_id: values.vehicleTypeId,
        make: values.make,
        model: values.model,
        color: values.color,
        plate_number: values.plateNumber,
        vin_number: values.vinNumber || null,
        engine_number: values.engineNumber || null,
        ref_code: values.refCode || null,
        is_active: values.isActive === "true",
      }
      if (isEdit) {
        const vehicleId =
          vehicle?.vehicle_uuid ?? vehicle?.vehicle_id ?? vehicle?.driver_vehicle_id
        if (!vehicleId) {
          toast.error("Missing vehicle id.")
          setLoading(false)
          return
        }
        const result = await updateVehicle(vehicleId, payload, accessToken)
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }
        toast.success("Vehicle updated.")
      } else {
        const result = await createVehicle(
          {
            merchant_id: activeMerchantId,
            ...payload,
          },
          accessToken
        )
        if (isApiErrorResponse(result)) {
          toast.error(result.message)
          return
        }
        toast.success("Vehicle created.")
      }
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
        {trigger ?? (
          <Button variant={isEdit ? "outline" : "default"}>
            {isEdit ? "Edit vehicle" : "New vehicle"}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vehicle" : "Create vehicle"}</DialogTitle>
          <DialogDescription>
            {isEdit ? "Update vehicle information." : "Add a vehicle."}
          </DialogDescription>
        </DialogHeader>
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
                onChange={(event) => updateValue("plateNumber", event.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">VIN number</label>
              <Input
                value={values.vinNumber}
                onChange={(event) => updateValue("vinNumber", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Engine number</label>
              <Input
                value={values.engineNumber}
                onChange={(event) =>
                  updateValue("engineNumber", event.target.value)
                }
              />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Reference code</label>
            <Input
              value={values.refCode}
              onChange={(event) => updateValue("refCode", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Status</label>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div className="space-y-1">
                <p className="text-sm font-medium leading-none">
                  {values.isActive === "true" ? "Active" : "Inactive"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Toggle whether this vehicle can be used.
                </p>
              </div>
              <Switch
                checked={values.isActive === "true"}
                onCheckedChange={(checked) =>
                  updateValue("isActive", checked ? "true" : "false")
                }
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
            {loading ? "Saving..." : isEdit ? "Save changes" : "Create vehicle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
