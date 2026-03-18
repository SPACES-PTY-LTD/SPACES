"use client"

import { ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteVehicleDialog } from "@/components/vehicles/delete-vehicle-dialog"
import { VehicleDialog } from "@/components/vehicles/vehicle-dialog"
import { VehicleMaintenanceDialog } from "@/components/vehicles/vehicle-maintenance-dialog"
import type { Vehicle } from "@/lib/types"

export function VehicleDetailActions({
  vehicle,
  merchantId,
  accessToken,
}: {
  vehicle: Vehicle
  merchantId?: string | null
  accessToken?: string
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          Actions
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <VehicleDialog
          vehicle={vehicle}
          merchantId={merchantId ?? vehicle.merchant_id ?? null}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              Edit vehicle
            </DropdownMenuItem>
          }
        />
        <VehicleMaintenanceDialog
          vehicle={vehicle}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem onSelect={(event) => event.preventDefault()}>
              {vehicle.maintenance_mode_at
                ? "Remove maintenance mode"
                : "Put in maintenance mode"}
            </DropdownMenuItem>
          }
        />
        <DeleteVehicleDialog
          vehicle={vehicle}
          accessToken={accessToken}
          trigger={
            <DropdownMenuItem
              variant="destructive"
              onSelect={(event) => event.preventDefault()}
            >
              Delete vehicle
            </DropdownMenuItem>
          }
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
