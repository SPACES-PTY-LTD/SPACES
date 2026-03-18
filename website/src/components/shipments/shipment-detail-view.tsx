import Link from "next/link"
import moment from "moment"
import { AdminRoute } from "@/lib/routes/admin"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Card, CardContent } from "@/components/ui/card"
import { ShipmentDetailActions } from "@/components/shipments/shipment-detail-actions"
import { ShipmentStopsOverview } from "@/components/shipments/shipment-stops-overview"
import { EntityFilesSection } from "@/components/files/entity-files-section"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLocationLabel } from "@/lib/address"
import type { Shipment } from "@/lib/types"
import type { ShipmentQuoteFormValues } from "@/components/shipments/shipment-quote-dialog"

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  return moment(value).format("YYYY-MM-DD HH:mm")
}

function hasParcelValue(value?: string | number | null) {
  return value !== null && value !== undefined && `${value}`.trim() !== ""
}

function buildParcelQrCodeUrl(value?: string | null) {
  if (!value) return null
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(value)}`
}

export function ShipmentDetailView({
  shipment,
  shipmentId,
  accessToken,
  merchantId,
  defaultTab,
  embedded = false,
  onEditSubmit,
}: {
  shipment: Shipment
  shipmentId: string
  accessToken: string
  merchantId?: string | null
  defaultTab?: string
  embedded?: boolean
  onEditSubmit: (values: ShipmentQuoteFormValues) => Promise<unknown>
}) {
  const parcels = shipment.parcels ?? []
  const latestStop =
    [...(shipment.stops ?? [])].sort((left, right) => {
      const leftTime = new Date(
        left.occurred_at ?? left.entered_at ?? left.created_at ?? 0
      ).getTime()
      const rightTime = new Date(
        right.occurred_at ?? right.entered_at ?? right.created_at ?? 0
      ).getTime()
      return rightTime - leftTime
    })[0] ?? null
  const shipmentVehicle = latestStop?.vehicle ?? null
  const shipmentDriver = latestStop?.driver ?? shipmentVehicle?.last_driver ?? null
  const customerLocation = shipment.dropoff_location ?? shipment.dropoff_address
  const invoiceNumber =
    shipment.invoice_number ?? shipment.invoice_invoice_number ?? ""
  const shipmentVehicleFallbackName = [
    shipmentVehicle?.make,
    shipmentVehicle?.model,
  ]
    .filter(Boolean)
    .join(" ")
  const shipmentVehicleFallback = shipmentVehicleFallbackName || null
  const shipmentVehicleName =
    shipmentVehicle?.plate_number ??
    shipmentVehicle?.ref_code ??
    shipmentVehicleFallback
  const resolvedDefaultTab =
    defaultTab === "details" ||
    defaultTab === "vehicle" ||
    defaultTab === "driver" ||
    defaultTab === "customer" ||
    defaultTab === "files"
      ? defaultTab
      : "details"

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      <PageHeader
        title={shipment.merchant_order_ref ?? shipment.shipment_id}
        description="Shipment detail, tracking, and label management."
        actions={
          <div className="flex items-center gap-2">
            <ShipmentDetailActions
              shipment={shipment}
              shipmentDriverId={shipmentDriver?.driver_id ?? null}
              shipmentDriverName={shipmentDriver?.name ?? null}
              shipmentVehicleName={shipmentVehicleName}
              runDriverExists={Boolean(shipmentDriver?.driver_id)}
              runVehicleExists={Boolean(
                shipmentVehicle?.vehicle_id ??
                  shipmentVehicle?.ref_code ??
                  shipmentVehicle?.plate_number
              )}
              deliveryNoteNumber={shipment.delivery_note_number ?? ""}
              invoiceNumber={invoiceNumber}
              selectedMerchantId={merchantId ?? null}
              accessToken={accessToken}
              editInitialValues={{
                merchantId: shipment.merchant_id ?? "",
                merchantOrderRef: shipment.merchant_order_ref ?? "",
                deliveryNoteNumber: shipment.delivery_note_number ?? "",
                invoiceInvoiceNumber: invoiceNumber,
                invoicedAt: shipment.invoiced_at ?? "",
                collectionDate: shipment.collection_date ?? "",
                pickupLocation: shipment.pickup_location ?? shipment.pickup_address,
                dropoffLocation: shipment.dropoff_location ?? shipment.dropoff_address,
                parcels: parcels.map((parcel) => ({
                  title: parcel.contents_description ?? "",
                  weight_kg: Number(parcel.weight_kg ?? parcel.weight ?? 0),
                  length_cm: Number(parcel.length_cm ?? 0),
                  width_cm: Number(parcel.width_cm ?? 0),
                  height_cm: Number(parcel.height_cm ?? 0),
                })),
              }}
              onEditSubmit={onEditSubmit}
            />
          </div>
        }
      />

      {shipment.stops && shipment.stops.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <ShipmentStopsOverview stops={shipment.stops} />
        </div>
      ) : null}

      <Tabs defaultValue={resolvedDefaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="vehicle">Vehicle</TabsTrigger>
          <TabsTrigger value="driver">Driver</TabsTrigger>
          <TabsTrigger value="customer">Customer</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Shipment status</span>
                <StatusBadge status={shipment.status} />
              </div>
              <div className="flex items-center justify-between">
                <span>Pickup</span>
                <span className="font-medium">
                  {getLocationLabel(shipment.pickup_location ?? shipment.pickup_address)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dropoff</span>
                <span className="font-medium">
                  {getLocationLabel(
                    shipment.dropoff_location ?? shipment.dropoff_address
                  )}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Merchant Order Ref</span>
                <span className="font-medium">
                  {shipment.merchant_order_ref ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Delivery Note Number</span>
                <span className="font-medium">
                  {shipment.delivery_note_number ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Invoice Number</span>
                <span className="font-medium">{invoiceNumber || "-"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Invoiced At</span>
                <span className="font-medium">
                  {formatDateTime(shipment.invoiced_at)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Pickup Instructions</span>
                <span className="font-medium">
                  {shipment.pickup_instructions ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Dropoff Instructions</span>
                <span className="font-medium">
                  {shipment.dropoff_instructions ?? "-"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Collection date</span>
                <span className="font-medium">
                  {formatDateTime(shipment.collection_date)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Ready At</span>
                <span className="font-medium">{formatDateTime(shipment.ready_at)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Created</span>
                <span className="text-muted-foreground">
                  {formatDateTime(shipment.created_at)}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-4 text-sm">
              <div className="text-xs text-muted-foreground uppercase">Parcels</div>
              {parcels.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No parcels available.
                </div>
              ) : (
                parcels.map((parcel, index) => {
                  const weightValue = parcel.weight_kg ?? parcel.weight ?? null
                  const weightLabel = hasParcelValue(weightValue)
                    ? `${weightValue}${parcel.weight_measurement ? ` ${parcel.weight_measurement}` : ""}`
                    : null
                  const qrCodeUrl = buildParcelQrCodeUrl(parcel.parcel_code)
                  const hasDimensions =
                    hasParcelValue(parcel.length_cm) &&
                    hasParcelValue(parcel.width_cm) &&
                    hasParcelValue(parcel.height_cm)
                  const parcelRows = [
                    hasParcelValue(weightLabel)
                      ? { label: "Weight", value: weightLabel }
                      : null,
                    hasDimensions
                      ? {
                          label: "Dimensions",
                          value: `${parcel.length_cm} × ${parcel.width_cm} × ${parcel.height_cm} cm`,
                        }
                      : null,
                    hasParcelValue(parcel.declared_value)
                      ? {
                          label: "Declared Value",
                          value: String(parcel.declared_value),
                        }
                      : null,
                    hasParcelValue(parcel.contents_description)
                      ? {
                          label: "Contents",
                          value: String(parcel.contents_description),
                        }
                      : null,
                  ].filter((row): row is { label: string; value: string } => Boolean(row))

                  return (
                    <div
                      key={parcel.parcel_id ?? `${shipmentId}-${index}`}
                      className="flex flex-row items-start gap-2 rounded-lg border border-border/60 p-2"
                    >
                      {qrCodeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrCodeUrl}
                          alt={`QR code for parcel ${parcel.parcel_code}`}
                          className="h-20 w-20"
                          loading="lazy"
                        />
                      ) : null}

                      <div className="flex-1">
                        <div className="font-bold">Parcel {index + 1}</div>
                        {parcel.parcel_code ? (
                          <div className="font-medium">{parcel.parcel_code}</div>
                        ) : null}
                        <div className="text-muted-foreground">
                          {parcelRows.map((row) => (
                            <div
                              key={row.label}
                              className="mt-2 flex items-center justify-between"
                            >
                              <span>{row.label}</span>
                              <span className="font-medium">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {parcelRows.length === 0 ? (
                        <div className="mt-2 text-sm text-muted-foreground">
                          No parcel details available.
                        </div>
                      ) : null}
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files">
          <EntityFilesSection
            entityType="shipment"
            entityId={shipmentId}
            accessToken={accessToken}
            merchantId={merchantId ?? null}
            title="Files"
            sectionId="files"
            hideExpiryColumn={true}
            hideStatusColumn={true}
          />
        </TabsContent>

        <TabsContent value="vehicle">
          <Card>
            <CardContent className="space-y-3 text-sm">
              {shipmentVehicle ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Vehicle ID</span>
                    <span className="font-medium">
                      {shipmentVehicle.vehicle_id ? (
                        <Link
                          href={AdminRoute.vehicleDetails(shipmentVehicle.vehicle_id)}
                          className="underline underline-offset-4"
                        >
                          {shipmentVehicle.vehicle_id}
                        </Link>
                      ) : (
                        shipmentVehicle.vehicle_id ?? "-"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Plate Number</span>
                    <span className="font-medium">
                      {shipmentVehicle.vehicle_id && shipmentVehicle.plate_number ? (
                        <Link
                          href={AdminRoute.vehicleDetails(shipmentVehicle.vehicle_id)}
                          className="underline underline-offset-4"
                        >
                          {shipmentVehicle.plate_number}
                        </Link>
                      ) : (
                        shipmentVehicle.plate_number ?? "-"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Reference Code</span>
                    <span className="font-medium">{shipmentVehicle.ref_code ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Make</span>
                    <span className="font-medium">{shipmentVehicle.make ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Model</span>
                    <span className="font-medium">{shipmentVehicle.model ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active</span>
                    <span className="font-medium">
                      {shipmentVehicle.is_active === undefined
                        ? "-"
                        : shipmentVehicle.is_active
                          ? "Yes"
                          : "No"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Driver Logged At</span>
                    <span className="font-medium">
                      {formatDateTime(shipmentVehicle.driver_logged_at)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">
                  No vehicle has been recorded for this shipment yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="driver">
          <Card>
            <CardContent className="space-y-3 text-sm">
              {shipmentDriver ? (
                <>
                  <div className="flex items-center justify-between">
                    <span>Driver ID</span>
                    <span className="font-medium">
                      {shipmentDriver.driver_id ? (
                        <Link
                          href={AdminRoute.driverDetails(shipmentDriver.driver_id)}
                          className="underline underline-offset-4"
                        >
                          {shipmentDriver.driver_id}
                        </Link>
                      ) : (
                        shipmentDriver.driver_id ?? "-"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Name</span>
                    <span className="font-medium">
                      {shipmentDriver.driver_id && shipmentDriver.name ? (
                        <Link
                          href={AdminRoute.driverDetails(shipmentDriver.driver_id)}
                          className="underline underline-offset-4"
                        >
                          {shipmentDriver.name}
                        </Link>
                      ) : (
                        shipmentDriver.name ?? "-"
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Email</span>
                    <span className="font-medium">{shipmentDriver.email ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Telephone</span>
                    <span className="font-medium">
                      {shipmentDriver.telephone ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Integration ID</span>
                    <span className="font-medium">
                      {shipmentDriver.intergration_id ?? "-"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active</span>
                    <span className="font-medium">
                      {shipmentDriver.is_active === undefined
                        ? "-"
                        : shipmentDriver.is_active
                          ? "Yes"
                          : "No"}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-muted-foreground">
                  No driver has been recorded for this shipment yet.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customer">
          <Card>
            <CardContent className="space-y-3 text-sm">
              {customerLocation ? (
                (() => {
                  const address =
                    customerLocation.full_address ??
                    getLocationLabel(customerLocation)

                  type CustomerField = {
                    label: string
                    value: React.ReactNode
                    className?: string
                  }

                  const customerFields: CustomerField[] = []

                  if (customerLocation.name) {
                    customerFields.push({
                      label: "Location Name",
                      value: customerLocation.location_id ? (
                        <Link
                          href={AdminRoute.locationDetails(
                            customerLocation.location_id
                          )}
                          className="underline underline-offset-4"
                        >
                          {customerLocation.name}
                        </Link>
                      ) : (
                        customerLocation.name
                      ),
                    })
                  }
                  if (customerLocation.code) {
                    customerFields.push({ label: "Code", value: customerLocation.code })
                  }
                  if (customerLocation.company) {
                    customerFields.push({
                      label: "Company",
                      value: customerLocation.company,
                    })
                  }
                  if (customerLocation.first_name) {
                    customerFields.push({
                      label: "First Name",
                      value: customerLocation.first_name,
                    })
                  }
                  if (customerLocation.last_name) {
                    customerFields.push({
                      label: "Last Name",
                      value: customerLocation.last_name,
                    })
                  }
                  if (customerLocation.phone) {
                    customerFields.push({ label: "Phone", value: customerLocation.phone })
                  }
                  if (customerLocation.email) {
                    customerFields.push({ label: "Email", value: customerLocation.email })
                  }
                  if (address && address !== "-") {
                    customerFields.push({
                      label: "Address",
                      value: address,
                      className: "text-right",
                    })
                  }
                  if (customerLocation.city ?? customerLocation.town) {
                    customerFields.push({
                      label: "City",
                      value: customerLocation.city ?? customerLocation.town ?? "",
                    })
                  }
                  if (customerLocation.province) {
                    customerFields.push({
                      label: "Province",
                      value: customerLocation.province,
                    })
                  }
                  if (customerLocation.country) {
                    customerFields.push({
                      label: "Country",
                      value: customerLocation.country,
                    })
                  }
                  if (customerLocation.post_code) {
                    customerFields.push({
                      label: "Post Code",
                      value: customerLocation.post_code,
                    })
                  }
                  if (shipment.dropoff_instructions) {
                    customerFields.push({
                      label: "Dropoff Instructions",
                      value: shipment.dropoff_instructions,
                      className: "text-right",
                    })
                  }

                  return customerFields.length > 0 ? (
                    <>
                      {customerFields.map((field) => (
                        <div
                          key={field.label}
                          className="flex items-center justify-between"
                        >
                          <span>{field.label}</span>
                          <span className={`font-medium ${field.className ?? ""}`}>
                            {field.value}
                          </span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-muted-foreground">
                      No dropoff customer information is available for this shipment.
                    </div>
                  )
                })()
              ) : (
                <div className="text-muted-foreground">
                  No dropoff customer information is available for this shipment.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
