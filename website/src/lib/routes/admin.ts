export type AdminRouteParam = string | number

const ADMIN_BASE = "/admin"
const LOGISTICS_BASE = `${ADMIN_BASE}/logistics`
const SHIPMENTS_BASE = `${LOGISTICS_BASE}/shipments`

export const AdminLinks = {
  dashboard: ADMIN_BASE,
  activityLog: `${ADMIN_BASE}/activity-log`,
  bookings: `${SHIPMENTS_BASE}/bookings`,
  billing: `${ADMIN_BASE}/billing`,
  cancelReasons: `${ADMIN_BASE}/cancel-reasons`,
  carriers: `${ADMIN_BASE}/settings/carriers`,
  drivers: `${LOGISTICS_BASE}/drivers`,
  locations: `${LOGISTICS_BASE}/locations`,
  members: `${ADMIN_BASE}/members`,
  merchants: `${ADMIN_BASE}/settings/merchants`,
  quotes: `${SHIPMENTS_BASE}/quotes`,
  routes: `${LOGISTICS_BASE}/routes`,
  settings: `${ADMIN_BASE}/settings`,
  settingsBilling: `${ADMIN_BASE}/settings/billing`,
  settingsAccount: `${ADMIN_BASE}/settings/account`,
  setup: `${ADMIN_BASE}/setup`,
  settingsCompliance: `${ADMIN_BASE}/settings/compliance`,
  settingsDeleteData: `${ADMIN_BASE}/settings/delete-data`,
  settingsEnvironments: `${ADMIN_BASE}/settings/environments`,
  settingsFileTypes: `${ADMIN_BASE}/settings/file-types`,
  settingsIntegrations: `${ADMIN_BASE}/settings/integrations`,
  settingsLocationAutomation: `${ADMIN_BASE}/settings/location-automation`,
  settingsLocationTypes: `${ADMIN_BASE}/settings/location-types`,
  settingsWorkspace: `${ADMIN_BASE}/settings/workspace`,
  shipments: `${LOGISTICS_BASE}/shipments`,
  tracking: `${SHIPMENTS_BASE}/tracking`,
  invoiced: `${SHIPMENTS_BASE}/invoiced`,
  users: `${ADMIN_BASE}/settings/users`,
  vehicleActivities: `${LOGISTICS_BASE}/vehicles/activities`,
  vehicleTypes: `${LOGISTICS_BASE}/vehicle-types`,
  vehicles: `${LOGISTICS_BASE}/vehicles`,
  vehiclesMap: `${LOGISTICS_BASE}/vehicles/map`,
  webhookDeliveries: `${ADMIN_BASE}/webhook-deliveries`,
  webhookSubscriptions: `${ADMIN_BASE}/settings/subscriptions`,
  reportsShipments: `${SHIPMENTS_BASE}/reports/shipments_report`,
  logistics_analytics: `${LOGISTICS_BASE}/analytics`,
  analyticsRouteWaitingTimes: `${LOGISTICS_BASE}/analytics/route-waiting-times`,
  analyticsStopsAnalysis: `${LOGISTICS_BASE}/analytics/stops-analysis`,
  analyticsDriversSpeeding: `${LOGISTICS_BASE}/analytics/drivers-speeding`,
  analyticsMissingDocuments: `${LOGISTICS_BASE}/analytics/missing-documents`,
  analyticsDocumentExpiry: `${LOGISTICS_BASE}/analytics/document-expiry`,
  analyticsDocumentCoverage: `${LOGISTICS_BASE}/analytics/document-coverage`,
  apps: `${ADMIN_BASE}/apps`,
  
  orders: `${ADMIN_BASE}/sales/orders`,
  ordersDrafts: `${ADMIN_BASE}/sales/orders/drafts`,
  ordersAbandonedCheckouts: `${ADMIN_BASE}/sales/orders/abandoned-checkouts`,
  customers: `${ADMIN_BASE}/sales/customers`,
  products: `${ADMIN_BASE}/inventory/products`,
  productsCollections: `${ADMIN_BASE}/inventory/products/collections`,
  productsInventory: `${ADMIN_BASE}/inventory/products/inventory`,
  productsPurchaseOrders: `${ADMIN_BASE}/inventory/products/purchase-orders`,
  productsTransfers: `${ADMIN_BASE}/inventory/products/transfers`,
  productsGiftCards: `${ADMIN_BASE}/inventory/products/gift-cards`,
  warehouses: `${ADMIN_BASE}/inventory/warehouses`,
} as const

export const AdminRoute = {
  activityLogDetails: (activityId: AdminRouteParam) => `${AdminLinks.activityLog}/${activityId}`,
  bookingDetails: (bookingId: AdminRouteParam) => `${AdminLinks.bookings}/${bookingId}`,
  cancelReasonDetails: (cancelReasonId: AdminRouteParam) => `${AdminLinks.cancelReasons}/${cancelReasonId}`,
  carrierDetails: (carrierId: AdminRouteParam) => `${AdminLinks.carriers}/${carrierId}`,
  driverDetails: (driverId: AdminRouteParam) => `${AdminLinks.drivers}/${driverId}`,
  locationDetails: (locationId: AdminRouteParam) => `${AdminLinks.locations}/${locationId}`,
  merchantDetails: (merchantId: AdminRouteParam) => `${AdminLinks.merchants}/${merchantId}`,
  quoteDetails: (quoteId: AdminRouteParam) => `${AdminLinks.quotes}/${quoteId}`,
  routeDetails: (routeId: AdminRouteParam) => `${AdminLinks.routes}/${routeId}`,
  shipmentDetails: (shipmentId: AdminRouteParam) => `${AdminLinks.shipments}/${shipmentId}`,
  userDetails: (userId: AdminRouteParam) => `${AdminLinks.users}/${userId}`,
  vehicleActivityDetails: (activityId: AdminRouteParam) => `${AdminLinks.vehicleActivities}/${activityId}`,
  vehicleDetails: (vehicleId: AdminRouteParam) => `${AdminLinks.vehicles}/${vehicleId}`,
  vehicleTypeDetails: (vehicleTypeId: AdminRouteParam) => `${AdminLinks.vehicleTypes}/${vehicleTypeId}`,
  webhookDeliveryDetails: (deliveryId: AdminRouteParam) => `${AdminLinks.webhookDeliveries}/${deliveryId}`,
  webhookSubscriptionDetails: (subscriptionId: AdminRouteParam) =>
    `${AdminLinks.webhookSubscriptions}/${subscriptionId}`,
} as const

export function withAdminQuery(
  path: string,
  params: Record<string, string | number | null | undefined>,
) {
  const searchParams = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") {
      continue
    }

    searchParams.set(key, String(value))
  }

  const query = searchParams.toString()
  return query ? `${path}?${query}` : path
}
