"use client"

import * as React from "react"
import { DataTable } from "@/components/common/data-table"
import { VehicleDialog } from "@/components/drivers/vehicle-dialog"
import { DeleteVehicleDialog } from "@/components/drivers/delete-vehicle-dialog"
import type { Vehicle } from "@/lib/types"

export function DriverVehiclesTable({
  driverId,
  vehicles,
  accessToken,
}: {
  driverId: string
  vehicles: Vehicle[]
  accessToken?: string
}) {
  const rows = vehicles.map((vehicle) => ({
    ...vehicle,
    vehicle,
  }))

  return (
    <DataTable
      data={rows}
      columns={[
        { key: "plate_number", label: "Plate" },
        { key: "make", label: "Make" },
        { key: "model", label: "Model" },
        { key: "color", label: "Color" },
        {
          key: "status",
          label: "Status",
          type: "status",
        },
        {
          key: "actions",
          label: "",
          className: "text-right",
          customValue: (row) => (
            <div className="flex justify-end gap-2">
              <VehicleDialog
                driverId={driverId}
                vehicle={row.vehicle}
                accessToken={accessToken}
              />
              <DeleteVehicleDialog
                vehicle={row.vehicle}
                accessToken={accessToken}
              />
            </div>
          ),
        },
      ]}
    />
  )
}
