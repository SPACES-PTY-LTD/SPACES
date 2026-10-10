import type { DriverShipment } from '@/src/lib/api';

export const shipmentSummaryFilters = ['Shipments', 'Remaining', 'Delivered'] as const;
export type ShipmentSummaryFilter = typeof shipmentSummaryFilters[number];

/** Use the same status rules for the tile counts and their shipment lists. */
export function summaryShipments(shipments: DriverShipment[], filter: ShipmentSummaryFilter) {
  if (filter === 'Delivered') return shipments.filter(shipment => shipment.status === 'delivered');
  if (filter === 'Remaining') return shipments.filter(shipment => !['delivered', 'failed', 'cancelled'].includes(shipment.status));
  return shipments;
}
