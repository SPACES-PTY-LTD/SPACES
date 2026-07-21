export type CsvValue = string | number | boolean | null | undefined
export type CsvRow = Record<string, CsvValue>

function csvCell(value: CsvValue) {
  if (value === null || value === undefined) return ""
  const text = String(value)
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text
}

export function buildCsv(rows: CsvRow[], headers?: string[]) {
  const columns = headers ?? Array.from(new Set(rows.flatMap((row) => Object.keys(row))))
  return "\uFEFF" + [
    columns.map(csvCell).join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\r\n")
}

export function downloadCsv(dataset: string, rows: CsvRow[], headers?: string[]) {
  const blob = new Blob([buildCsv(rows, headers)], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  const date = new Date().toISOString().slice(0, 10)
  anchor.href = url
  anchor.download = dataset + "-" + date + "-" + rows.length + ".csv"
  anchor.click()
  URL.revokeObjectURL(url)
}

const value = (row: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((current, key) =>
    current && typeof current === "object"
      ? (current as Record<string, unknown>)[key]
      : undefined, row)

const scalar = (input: unknown): CsvValue => {
  if (input === null || input === undefined) return ""
  if (typeof input === "string" || typeof input === "number" || typeof input === "boolean") return input
  return JSON.stringify(input)
}

const pick = (row: Record<string, unknown>, paths: string[]) =>
  Object.fromEntries(paths.map((path) => [path.replaceAll(".", "_"), scalar(value(row, path))]))

const address = (row: Record<string, unknown>, prefix: string) => pick(row, [
  prefix + ".location_id", prefix + ".name", prefix + ".code", prefix + ".company",
  prefix + ".full_address", prefix + ".address_line_1", prefix + ".address_line_2",
  prefix + ".town", prefix + ".city", prefix + ".province", prefix + ".post_code",
  prefix + ".country", prefix + ".first_name", prefix + ".last_name", prefix + ".phone",
  prefix + ".email", prefix + ".latitude", prefix + ".longitude",
])

const minutesBetween = (start: unknown, end: unknown) => {
  if (typeof start !== "string" || typeof end !== "string") return ""
  const milliseconds = new Date(end).getTime() - new Date(start).getTime()
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return ""
  const minutes = Math.round(milliseconds / 60000)
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export type LogisticsExportResource =
  | "vehicles" | "locations" | "shipments" | "drivers"
  | "shipment-report" | "routes" | "vehicle-activities"

export function mapLogisticsCsvRows(resource: LogisticsExportResource, records: Record<string, unknown>[]): CsvRow[] {
  if (resource === "drivers") {
    return records.map((row) => ({
      name: scalar(row.name), email: scalar(row.email), telephone: scalar(row.telephone),
      password: "", carrier_id: scalar(value(row, "carrier.carrier_id")),
      vehicle_type_id: scalar(row.vehicle_type_id), intergration_id: scalar(row.intergration_id),
      is_active: scalar(row.is_active), notes: scalar(row.notes),
      metadata_json: row.metadata ? JSON.stringify(row.metadata) : "",
    }))
  }

  if (resource === "shipments") {
    return records.flatMap((row) => {
      const parcels = Array.isArray(row.parcels) && row.parcels.length ? row.parcels : [null]
      const parent = {
        ...pick(row, [
          "shipment_id", "merchant.merchant_id", "merchant.name", "environment_id",
          "merchant_order_ref", "delivery_note_number", "invoice_number", "invoiced_at",
          "status", "collection_date", "ready_at", "service_type", "priority", "auto_assign",
          "auto_created", "pickup_instructions", "dropoff_instructions", "notes",
          "run_id", "run_status", "run_sequence", "run_shipment_status",
          "driver.driver_id", "driver.name", "driver.email", "driver.telephone",
          "vehicle.vehicle_id", "vehicle.plate_number", "vehicle.ref_code",
          "booking.booking_id", "booking.status", "booking.total_km_from_collection", "created_at",
        ]),
        ...address(row, "pickup_location"),
        ...address(row, "dropoff_location"),
        metadata_json: row.metadata ? JSON.stringify(row.metadata) : "",
      }
      return parcels.map((parcel) => ({
        ...parent,
        ...(parcel ? pick(parcel as Record<string, unknown>, [
          "parcel_id", "parcel_code", "type", "contents_description", "weight",
          "weight_kg", "weight_measurement", "length_cm", "width_cm", "height_cm", "declared_value",
        ]) : {}),
      }))
    })
  }

  if (resource === "routes") {
    return records.flatMap((row) => {
      const stops = Array.isArray(row.stops) && row.stops.length ? row.stops : [null]
      const parent = pick(row, [
        "route_id", "merchant_id", "environment_id", "title", "code", "description",
        "estimated_distance", "estimated_duration", "estimated_collection_time",
        "estimated_delivery_time", "auto_created", "created_at", "updated_at",
      ])
      return stops.map((stop) => ({
        ...parent,
        ...(stop ? pick(stop as Record<string, unknown>, [
          "stop_id", "sequence", "location_id", "location.name", "location.code",
          "location.company", "location.type", "location.full_address", "location.city",
          "location.province", "location.country", "location.latitude", "location.longitude",
        ]) : {}),
      }))
    })
  }


  if (resource === "shipment-report") {
    return records.map((row) => ({
      ...pick(row, [
        "shipment_id", "vehicle_id", "driver_id", "run_id", "date_created", "collection_date",
        "shipment_number", "delivery_note_number", "invoice_number", "shipment_status",
        "truck_plate_number", "driver", "shipment_type", "from_time_in", "from_time_to",
        "from_time_out", "to_time_in", "to_time_out", "run_started_at", "run_completed_at",
        "run_duration_seconds", "run_odometer_start_km", "run_odometer_end_km",
        "run_odometer_distance_km", "odometer_at_collection", "odometer_at_delivery",
        "total_km_from_collection", "delivered_volume",
      ]),
      ...address(row, "from_location"),
      ...address(row, "to_location"),
      from_location_display: scalar(row.from_location_display ?? value(row, "from_location.full_address") ?? value(row, "from_location.name")),
      to_location_display: scalar(row.to_location_display ?? value(row, "to_location.full_address") ?? value(row, "to_location.name")),
      from_total_time: scalar(row.from_total_time ?? minutesBetween(row.from_time_in, row.from_time_out)),
      to_total_time: scalar(row.to_total_time ?? minutesBetween(row.to_time_in, row.to_time_out)),
    }))
  }

  const fields: Record<Exclude<LogisticsExportResource, "drivers" | "shipments" | "routes" | "shipment-report">, string[]> = {
    vehicles: [
      "vehicle_id", "merchant_id", "plate_number", "vin_number", "engine_number", "ref_code",
      "intergration_id", "type.vehicle_type_id", "type.name", "make", "model", "color", "year",
      "odometer", "is_active", "is_on_a_run", "last_location_address", "location_updated_at",
      "last_driver.driver_id", "last_driver.name", "last_driver.email", "driver_logged_at",
      "maintenance_mode_at", "maintenance_expected_resolved_at", "maintenance_description",
      "imported_at", "created_at", "updated_at",
    ],
    locations: ["location_id", "merchant_id", "environment_id", "name", "code", "company", "full_address", "address_line_1", "address_line_2", "town", "city", "province", "post_code", "country", "first_name", "last_name", "phone", "email", "latitude", "longitude", "google_place_id", "location_type_id", "type.title", "type.slug", "intergration_id", "imported_at", "created_at", "updated_at"],
    "vehicle-activities": [
      "activity_id", "merchant.merchant_id", "merchant.name", "event_type", "occurred_at",
      "entered_at", "exited_at", "vehicle.vehicle_id", "vehicle.plate_number", "vehicle.ref_code",
      "vehicle.make", "vehicle.model", "driver.driver_id", "driver.name", "driver.email",
      "driver.telephone", "location.location_id", "location.name", "location.company", "location.code",
      "location.type.title", "location.type.slug", "location.full_address", "location.city",
      "location.province", "location.country", "shipment.shipment_id",
      "shipment.merchant_order_ref", "shipment.status", "run_id", "latitude", "longitude",
      "speed_kph", "speed_limit_kph", "exit_reason", "created_at",
    ],
  }

  return records.map((row) => ({
    ...pick(row, fields[resource]),
    ...(resource === "vehicles" ? {
      tags: Array.isArray(row.tags) ? row.tags.map((tag) => (tag as { name?: string }).name).filter(Boolean).join("|") : "",
      metadata_json: row.metadata ? JSON.stringify(row.metadata) : "",
    } : {}),
    ...(resource === "locations" ? { tags: Array.isArray(row.tags) ? row.tags.map((tag) => (tag as { name?: string }).name).filter(Boolean).join("|") : "", metadata_json: row.metadata ? JSON.stringify(row.metadata) : "" } : {}),
    ...(resource === "vehicle-activities" ? { metadata_json: row.metadata ? JSON.stringify(row.metadata) : "" } : {}),
  }))
}
