import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { PageHeader } from "@/components/layout/page-header"
import { StatusBadge } from "@/components/common/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ErrorMessage } from "@/components/common/error-message"
import { isApiErrorResponse } from "@/lib/api/client"
import { getDriverBooking } from "@/lib/api/driver"
import { requireAuth } from "@/lib/auth"

export default async function DriverBookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>
}) {
  const { bookingId } = await params
  const session = await requireAuth()
  const booking = await getDriverBooking(bookingId, session.accessToken)
  if (isApiErrorResponse(booking)) {
    return (
      <ErrorMessage
        title="Booking"
        description="Update delivery status and capture scans."
        message={booking.message}
      />
    )
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Driver", href: "/driver/bookings" },
          { label: booking.booking_id },
        ]}
      />
      <PageHeader
        title={`Booking ${booking.booking_id}`}
        description="Update delivery status and capture scans."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline">Update status</Button>
            <Button variant="outline">Scan package</Button>
            <Button>Upload POD</Button>
            <Button variant="destructive">Cancel</Button>
          </div>
        }
      />
      <Card>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <StatusBadge status={booking.status} />
          </div>
          <div className="flex items-center justify-between">
            <span>Shipment</span>
            <span className="font-medium">{booking.shipment_id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Booked at</span>
            <span className="text-muted-foreground">{booking.booked_at}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
