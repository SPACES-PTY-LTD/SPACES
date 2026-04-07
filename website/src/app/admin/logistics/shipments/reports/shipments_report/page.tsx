import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import Link from "next/link"
import { DataTable } from "@/components/common/data-table"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { isApiErrorResponse } from "@/lib/api/client"
import {
  getShipmentsFullReport,
  type ShipmentFullReportRow,
  type ShipmentsFullReportSortBy,
} from "@/lib/api/reports"
import { listTags } from "@/lib/api/tags"
import { requireAuth } from "@/lib/auth"
import { normalizeTableMeta } from "@/lib/table"
import type { Location } from "@/lib/types"

type ShipmentsReportPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

type SortDirection = "asc" | "desc"

const SORTABLE_COLUMNS = [
  "date_created",
  "collection_date",
  "shipment_number",
  "delivery_note_number",
  "truck_plate_number",
  "driver_name",
  "shipment_status",
  "delivered_volume",
] as const satisfies readonly ShipmentsFullReportSortBy[]

function getSingleValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : (value ?? "")
}

function normalizeText(value: string) {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function normalizeDate(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined
}

function toPositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1) return fallback
  return Math.floor(parsed)
}

function normalizeSortBy(value: string) {
  const normalized = normalizeText(value)
  if (!normalized) return undefined
  return SORTABLE_COLUMNS.includes(normalized as ShipmentsFullReportSortBy)
    ? (normalized as ShipmentsFullReportSortBy)
    : undefined
}

function normalizeSortDirection(value: string): SortDirection | undefined {
  const normalized = normalizeText(value)?.toLowerCase()
  if (normalized === "asc" || normalized === "desc") return normalized
  return undefined
}

function formatLocation(location?: Location | null) {
  if (!location) return "-"

  const primary = [location.name, location.code ? `(${location.code})` : ""]
    .filter(Boolean)
    .join(" ")
  const fallback = location.address_line_1 ?? location.city ?? location.country
  const value = primary || fallback || "-"

  return value
}

export default async function ShipmentsReportPage({ searchParams }: ShipmentsReportPageProps) {
  const params = (await searchParams) ?? {}
  const dateCreated = getSingleValue(params.date_created)
  const createdFrom = getSingleValue(params.created_from)
  const createdTo = getSingleValue(params.created_to)
  const collectionDate = getSingleValue(params.collection_date)
  const shipmentNumber = getSingleValue(params.shipment_number)
  const deliveryNoteNumber = getSingleValue(params.delivery_note_number)
  const truckPlateNumber = getSingleValue(params.truck_plate_number)
  const driverId = getSingleValue(params.driver_id)
  const fromLocationId = getSingleValue(params.from_location_id)
  const toLocationId = getSingleValue(params.to_location_id)
  const locationTagId = getSingleValue(params.location_tag_id)
  const vehicleTagId = getSingleValue(params.vehicle_tag_id)
  const shipmentStatus = getSingleValue(params.shipment_status)
  const page = toPositiveInt(getSingleValue(params.page), 1)
  const perPage = Math.min(200, toPositiveInt(getSingleValue(params.per_page), 50))
  const sortBy = normalizeSortBy(getSingleValue(params.sort_by))
  const sortDirection = normalizeSortDirection(getSingleValue(params.sort_direction))

  const session = await requireAuth()
  const merchantId = session.selected_merchant?.merchant_id ?? undefined
  const canLoad = Boolean(merchantId)
  const tagsResponse = merchantId
    ? await listTags(session.accessToken, { merchant_id: merchantId, per_page: 100 })
    : null
  const tags =
    tagsResponse && !isApiErrorResponse(tagsResponse)
      ? tagsResponse.data
      : []
  const response = canLoad
    ? await getShipmentsFullReport(
        {
          merchant_id: merchantId,
          date_created: normalizeDate(dateCreated),
          created_from: normalizeDate(createdFrom),
          created_to: normalizeDate(createdTo),
          collection_date: normalizeDate(collectionDate),
          shipment_number: normalizeText(shipmentNumber),
          delivery_note_number: normalizeText(deliveryNoteNumber),
          truck_plate_number: normalizeText(truckPlateNumber),
          driver_id: normalizeText(driverId),
          from_location_id: normalizeText(fromLocationId),
          to_location_id: normalizeText(toLocationId),
          location_tag_id: normalizeText(locationTagId),
          vehicle_tag_id: normalizeText(vehicleTagId),
          shipment_status: normalizeText(shipmentStatus),
          sort_by: sortBy,
          sort_direction: sortDirection,
          page,
          per_page: perPage,
        },
        session.accessToken
      )
    : null

  const errorResponse = response && isApiErrorResponse(response) ? response : null
  const successResponse = response && !isApiErrorResponse(response) ? response : null
  const loadingError = canLoad
    ? errorResponse?.message ?? null
    : "Select a merchant to view the shipments report."
  const reportRows: ShipmentFullReportRow[] = successResponse?.data ?? []
  const rows = reportRows.map((item) => ({
    ...item,
    from_location_display: formatLocation(item.from_location),
    to_location_display: formatLocation(item.to_location),
    shipment_href: item.shipment_id ? AdminRoute.shipmentDetails(item.shipment_id) : "",
    vehicle_href: item.vehicle_id ? AdminRoute.vehicleDetails(item.vehicle_id) : "",
    driver_href: item.driver_id ? AdminRoute.driverDetails(item.driver_id) : "",
    from_location_href: item.from_location?.location_id
      ? AdminRoute.locationDetails(item.from_location.location_id)
      : "",
    to_location_href: item.to_location?.location_id
      ? AdminRoute.locationDetails(item.to_location.location_id)
      : "",
  }))
  const tableMeta = successResponse ? normalizeTableMeta(successResponse.meta) : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Shipments Report"
        description="Review shipment delivery performance with filterable and sortable report data."
        actions={
          <Button asChild variant="outline">
            <Link href={AdminLinks.reportsShipments}>Reset</Link>
          </Button>
        }
      />

      <DataTable
        data={rows}
        meta={tableMeta}
        loading_error={loadingError}
        width="3000px"
        filters={[
          {
            key: "date_created",
            label: "Date created",
            type: "date",
            value: dateCreated,
            url_param_name: "date_created",
          },
          {
            key: "created_from",
            label: "Created from",
            type: "date",
            value: createdFrom,
            url_param_name: "created_from",
          },
          {
            key: "created_to",
            label: "Created to",
            type: "date",
            value: createdTo,
            url_param_name: "created_to",
          },
          {
            key: "collection_date",
            label: "Collection date",
            type: "date",
            value: collectionDate,
            url_param_name: "collection_date",
          },
          {
            key: "shipment_number",
            label: "Shipment number",
            type: "text",
            value: shipmentNumber,
            url_param_name: "shipment_number",
            placeholder: "ORDER-123",
          },
          {
            key: "delivery_note_number",
            label: "Delivery note",
            type: "text",
            value: deliveryNoteNumber,
            url_param_name: "delivery_note_number",
            placeholder: "DN-123",
          },
          {
            key: "truck_plate_number",
            label: "Truck plate number",
            type: "text",
            value: truckPlateNumber,
            url_param_name: "truck_plate_number",
            placeholder: "CA123456",
          },
          {
            key: "driver_id",
            label: "Driver ID",
            type: "text",
            value: driverId,
            url_param_name: "driver_id",
            placeholder: "Driver UUID",
          },
          {
            key: "from_location_id",
            label: "From location ID",
            type: "text",
            value: fromLocationId,
            url_param_name: "from_location_id",
            placeholder: "Location UUID",
          },
          {
            key: "to_location_id",
            label: "To location ID",
            type: "text",
            value: toLocationId,
            url_param_name: "to_location_id",
            placeholder: "Location UUID",
          },
          {
            key: "location_tag",
            label: "Location tag",
            value: locationTagId,
            url_param_name: "location_tag_id",
            options: tags.map((tag) => ({
              label: tag.name,
              value: tag.tag_id,
            })),
          },
          {
            key: "vehicle_tag",
            label: "Vehicle tag",
            value: vehicleTagId,
            url_param_name: "vehicle_tag_id",
            options: tags.map((tag) => ({
              label: tag.name,
              value: tag.tag_id,
            })),
          },
          {
            key: "shipment_status",
            label: "Shipment status",
            type: "text",
            value: shipmentStatus,
            url_param_name: "shipment_status",
            placeholder: "delivered",
          },
          {
            key: "per_page",
            label: "Per page",
            value: String(perPage),
            url_param_name: "per_page",
            options: [
              { label: "20", value: "20" },
              { label: "50", value: "50" },
              { label: "100", value: "100" },
              { label: "200", value: "200" },
            ],
          },
        ]}
        enableSorting
        sortDirParam="sort_direction"
        sortableColumns={[
          "date_created",
          "collection_date",
          "shipment_number",
          "delivery_note_number",
          "truck_plate_number",
          "driver",
          "shipment_status",
          "delivered_volume",
        ]}
        sortKeyMap={{ driver: "driver_name" }}
        searchKeys={[
          "shipment_number",
          "delivery_note_number",
          "truck_plate_number",
          "driver",
          "shipment_status",
          "delivered_volume",
          "from_location_display",
          "to_location_display",
        ]}
        columns={[
          { key: "date_created", label: "Date Created", link: "shipment_href", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "collection_date", label: "Collection Date", link: "shipment_href", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "shipment_number", label: "Shipment Number", link: "shipment_href" },
          { key: "delivery_note_number", label: "Delivery Note Number", link: "shipment_href" },
          { key: "truck_plate_number", label: "Truck Plate Number", link: "vehicle_href" },
          { key: "driver", label: "Driver", link: "driver_href" },
          { key: "shipment_type", label: "Shipment Type", link: "shipment_href" },
          { key: "from_location_display", label: "From Location", link: "from_location_href" },
          { key: "to_location_display", label: "To Location", link: "to_location_href" },
          { key: "from_time_in", label: "From Time In", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "from_time_to", label: "From Time Out", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "to_time_in", label: "To Time In", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "to_time_out", label: "To Time Out", type: "date_time", format: "YYYY-MM-DD HH:mm" },
          { key: "shipment_status", label: "Shipment Status", type: "status" },
          { key: "delivered_volume", label: "Delivered Volume" },
        ]}
      />
    </div>
  )
}
