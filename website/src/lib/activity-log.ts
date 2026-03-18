import { AdminRoute } from "@/lib/routes/admin"
export function getActivityEntityHref(
  entityType?: string | null,
  entityId?: string | null
) {
  if (!entityType || !entityId) return ""

  switch (entityType.toLowerCase()) {
    case "booking":
      return AdminRoute.bookingDetails(entityId)
    case "quote":
      return AdminRoute.quoteDetails(entityId)
    case "vehicle":
      return AdminRoute.vehicleDetails(entityId)
    case "driver":
      return AdminRoute.driverDetails(entityId)
    case "location":
      return AdminRoute.locationDetails(entityId)
    case "shipment":
      return AdminRoute.shipmentDetails(entityId)
    case "merchant":
      return AdminRoute.merchantDetails(entityId)
    default:
      return ""
  }
}

export function getActivityLogHref(activityId?: string | null) {
  if (!activityId) return ""
  return AdminRoute.activityLogDetails(activityId)
}
