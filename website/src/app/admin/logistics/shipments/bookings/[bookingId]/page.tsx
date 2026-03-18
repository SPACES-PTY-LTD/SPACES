import { AdminLinks, AdminRoute } from "@/lib/routes/admin"
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { ErrorMessage } from "@/components/common/error-message"
import { Card, CardContent } from "@/components/ui/card"
import { isApiErrorResponse } from "@/lib/api/client"
import { getBooking } from "@/lib/api/bookings"
import { getLocationLabel } from "@/lib/address"
import { getScopedMerchantId, requireAuth } from "@/lib/auth"
import moment from "moment"
import Link from "next/link"
import { BookingActions } from "@/components/bookings/booking-actions"

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params

  const session = await requireAuth()
  const booking = await getBooking(bookingId, session.accessToken, {
    merchant_id: getScopedMerchantId(session),
  })
  if (isApiErrorResponse(booking)) {
    return (
      <ErrorMessage
        title="Booking"
        description="Driver assignment and status control."
        message={booking.message}
      />
    )
  }
  const shipment = booking.shipment
  const option = booking.quote_option
  const shipmentId = shipment?.shipment_id ?? booking.shipment_id
  const carrierLabel = booking.carrier_code ?? option?.carrier_code

  
  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Bookings", href: AdminLinks.bookings },
          { label: booking.booking_id },
        ]}
      />
      <PageHeader
        title={`Booking ${booking.booking_id}`}
        description="Driver assignment and status control."
        actions={
          <BookingActions
            bookingId={booking.booking_id}
            shipmentId={shipmentId}
            accessToken={session.accessToken}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Status</div>
            <StatusBadge status={booking.status} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Carrier</div>
            <div className="text-sm font-medium">
              {carrierLabel ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  href={AdminLinks.carriers}
                >
                  {carrierLabel}
                </Link>
              ) : (
                "-"
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Booked At</div>
            <div className="text-sm font-medium">
              {booking.booked_at
                ? moment(booking.booked_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Shipment ID</span>
            <span className="font-medium">
              {shipmentId ? (
                <Link
                  className="text-primary underline-offset-4 hover:underline"
                  href={AdminRoute.shipmentDetails(shipmentId)}
                >
                  {shipmentId}
                </Link>
              ) : (
                "-"
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Merchant Order Ref</span>
            <span className="font-medium">
              {shipment?.merchant_order_ref ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipment Status</span>
            <span className="font-medium">{shipment?.status ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Pickup</span>
            <span className="font-medium">
              {getLocationLabel(shipment?.pickup_location ?? shipment?.pickup_address)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Dropoff</span>
            <span className="font-medium">
              {getLocationLabel(
                shipment?.dropoff_location ?? shipment?.dropoff_address
              )}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Shipment Created</span>
            <span className="text-muted-foreground">
              {shipment?.created_at
                ? moment(shipment.created_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Service</span>
            <span className="font-medium">{option?.service_code ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Quote Option</span>
            <span className="font-medium">
              {option?.quote_option_id ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Total</span>
            <span className="font-medium">
              {option
                ? `${option.currency} ${Number(option.total_amount).toFixed(2)}`
                : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>ETA Window</span>
            <span className="font-medium">
              {option?.eta_from
                ? `${moment(option.eta_from).format("YYYY-MM-DD HH:mm")} → ${moment(option.eta_to).format("YYYY-MM-DD HH:mm")}`
                : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Max Weight (kg)</span>
            <span className="font-medium">
              {option?.rules?.max_weight_kg ?? "-"}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 text-sm">
          <div className="flex items-center justify-between">
            <span>Carrier Job ID</span>
            <span className="font-medium">{booking.carrier_job_id ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Current Driver ID</span>
            <span className="font-medium">{booking.current_driver_id ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Label URL</span>
            <span className="font-medium">{booking.label_url ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Cancelled At</span>
            <span className="font-medium">
              {booking.cancelled_at
                ? moment(booking.cancelled_at).format("YYYY-MM-DD HH:mm")
                : "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Cancellation Reason Code</span>
            <span className="font-medium">
              {booking.cancellation_reason_code ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>Cancellation Note</span>
            <span className="font-medium">
              {booking.cancellation_reason_note ?? "-"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span>POD</span>
            <span className="font-medium">{booking.pod ?? "-"}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
