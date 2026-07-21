"use client"

import * as React from "react"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import type { DataTableSelectionState } from "@/components/common/data-table"
import { isApiErrorResponse } from "@/lib/api/client"
import { listVehicles } from "@/lib/api/vehicles"
import { listLocations } from "@/lib/api/locations"
import { listShipments } from "@/lib/api/shipments"
import { listDrivers } from "@/lib/api/drivers"
import { listRoutes } from "@/lib/api/routes"
import { listVehicleActivities } from "@/lib/api/vehicle-activities"
import { getShipmentsFullReport } from "@/lib/api/reports"
import {
  downloadCsv, mapLogisticsCsvRows, type LogisticsExportResource,
} from "@/lib/csv-export"

type Row = Record<string, unknown>

const rowId = (row: Row) => String(
  row.shipment_id ?? row.vehicle_id ?? row.vehicle_uuid ?? row.location_id ??
  row.driver_id ?? row.route_id ?? row.activity_id ?? JSON.stringify(row)
)

const param = (query: URLSearchParams, key: string) => query.get(key) || undefined
const boolParam = (query: URLSearchParams, key: string) => {
  const input = param(query, key)
  return input === "true" ? true : input === "false" ? false : undefined
}

async function fetchPage(
  resource: LogisticsExportResource,
  token: string | undefined,
  merchantId: string | null | undefined,
  query: URLSearchParams,
  page: number
) {
  const common = { merchant_id: merchantId ?? param(query, "merchant_id"), page, per_page: resource === "shipment-report" ? 200 : 100 }
  switch (resource) {
    case "vehicles":
      return listVehicles(token, { ...common, tag_id: param(query, "tag_id"), sort_by: param(query, "sort_by"), sort_dir: param(query, "sort_dir") as "asc" | "desc" | undefined })
    case "locations":
      return listLocations(token, { ...common, search: param(query, "search"), location_type_id: param(query, "location_type_id"), tag_id: param(query, "tag_id"), sort_by: param(query, "sort_by"), sort_dir: param(query, "sort_dir") as "asc" | "desc" | undefined })
    case "shipments":
      return listShipments(token, { ...common, status: param(query, "status"), priority: param(query, "priority"), auto_assign: boolParam(query, "auto_assign"), invoiced: boolParam(query, "invoiced"), from: param(query, "from"), to: param(query, "to"), location_tag_id: param(query, "location_tag_id"), vehicle_tag_id: param(query, "vehicle_tag_id"), sort_by: param(query, "sort_by"), sort_dir: param(query, "sort_dir") as "asc" | "desc" | undefined })
    case "drivers":
      return listDrivers(token, { ...common, search: param(query, "search"), sort_by: param(query, "sort_by"), sort_dir: param(query, "sort_dir") as "asc" | "desc" | undefined })
    case "routes":
      return listRoutes(token, { ...common, search: param(query, "search"), sort_by: param(query, "sort_by"), sort_dir: param(query, "sort_dir") as "asc" | "desc" | undefined })
    case "vehicle-activities":
      return listVehicleActivities(token, { ...common, vehicle_id: param(query, "vehicle_id"), location_id: param(query, "location_id"), location_type_id: param(query, "location_type_id"), plate_number: param(query, "plate_number"), event_type: param(query, "event_type"), from: param(query, "from"), to: param(query, "to") })
    case "shipment-report":
      return getShipmentsFullReport({
        ...common,
        date_created: param(query, "date_created"), created_from: param(query, "created_from"),
        created_to: param(query, "created_to"), collection_date: param(query, "collection_date"),
        shipment_number: param(query, "shipment_number"), delivery_note_number: param(query, "delivery_note_number"),
        truck_plate_number: param(query, "truck_plate_number"), driver_id: param(query, "driver_id"),
        from_location_id: param(query, "from_location_id"), to_location_id: param(query, "to_location_id"),
        location_tag_id: param(query, "location_tag_id"), vehicle_tag_id: param(query, "vehicle_tag_id"),
        shipment_status: param(query, "shipment_status"), sort_by: param(query, "sort_by") as never,
        sort_direction: param(query, "sort_direction") as "asc" | "desc" | undefined,
      }, token)
  }
}

async function allFilteredRows(
  resource: LogisticsExportResource,
  token: string | undefined,
  merchantId: string | null | undefined,
  query: URLSearchParams
) {
  const rows: Row[] = []
  const seen = new Set<string>()
  let page = 1
  let lastPage = 1
  do {
    const response = await fetchPage(resource, token, merchantId, query, page)
    if (isApiErrorResponse(response)) throw new Error(response.message)
    const pageRows = (response.data ?? []) as unknown as Row[]
    for (const row of pageRows) {
      const key = rowId(row)
      if (!seen.has(key)) {
        seen.add(key)
        rows.push(row)
      }
    }
    lastPage = Math.max(Number(response.meta?.last_page ?? 1), 1)
    page += 1
  } while (page <= lastPage)
  return rows
}

async function selectedRowsAcrossPages(
  resource: LogisticsExportResource,
  token: string | undefined,
  merchantId: string | null | undefined,
  selection: DataTableSelectionState<Row>
) {
  if (selection.selectedRows.length === selection.selectedIds.length) return selection.selectedRows

  const selectedIds = new Set(selection.selectedIds)
  const filteredRows = await allFilteredRows(resource, token, merchantId, selection.queryParams)
  return filteredRows.filter((row) => selectedIds.has(rowId(row)))
}

export function CsvExportAction<T extends Row>({
  resource, selection, accessToken, merchantId,
}: {
  resource: LogisticsExportResource
  selection: DataTableSelectionState<T>
  accessToken?: string
  merchantId?: string | null
}) {
  const [exporting, setExporting] = React.useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const records = selection.mode === "all_filtered"
        ? await allFilteredRows(resource, accessToken, merchantId, selection.queryParams)
        : await selectedRowsAcrossPages(
          resource,
          accessToken,
          merchantId,
          selection as DataTableSelectionState<Row>
        )
      const rows = mapLogisticsCsvRows(resource, records)
      if (!rows.length) throw new Error("No selected rows were available to export.")
      const driverHeaders = resource === "drivers"
        ? ["name", "email", "telephone", "password", "carrier_id", "vehicle_type_id", "intergration_id", "is_active", "notes", "metadata_json"]
        : undefined
      downloadCsv(resource, rows, driverHeaders)
      toast.success("CSV export downloaded.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to export the selected rows.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={exporting} onClick={() => void handleExport()}>
      {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
      {exporting ? "Exporting..." : "Export CSV"}
    </Button>
  )
}
