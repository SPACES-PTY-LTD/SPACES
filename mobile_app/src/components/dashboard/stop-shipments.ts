import type { DriverShipment } from '../../lib/api';
import type { RunStop } from './RunTimeline';

const normalized = (value?: string | null) => value?.trim().replace(/\s+/g, ' ').toLowerCase() || '';

/** Match only this run's authorized shipments, by saved ID or an unambiguous legacy identity. */
export function shipmentsAtStop(stop: RunStop | null, shipments: DriverShipment[]) {
  const empty = { deliveries: [] as DriverShipment[], collections: [] as DriverShipment[] };
  if (!stop || stop.kind === 'Speeding') return empty;
  let locationId = stop.location_id;
  if (locationId === undefined) {
    // Older API timelines omit the saved ID. Never match a name or coordinates alone.
    const name = normalized(stop.name);
    const address = normalized(stop.address);
    if (!name || !address) return empty;
    const ids = new Set(shipments.flatMap(s => [s.pickup_location, s.dropoff_location])
      .filter(l => l && normalized(l.name) === name && normalized(l.full_address) === address)
      .map(l => l!.location_id));
    if (ids.size !== 1) return empty;
    locationId = [...ids][0];
  }
  if (!locationId) return empty;
  const unique = [...new Map(shipments.map(s => [s.shipment_id, s])).values()];
  return {
    deliveries: unique.filter(s => s.dropoff_location?.location_id === locationId),
    collections: unique.filter(s => s.pickup_location?.location_id === locationId),
  };
}

export function stopShipmentStatus(shipment: DriverShipment) {
  const value = shipment.booking?.status || shipment.status;
  if (value === 'failed') return 'Failed Delivery';
  return value ? value.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase()) : 'Status unavailable';
}
