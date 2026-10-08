import type { RunStop } from './RunTimeline';
import type { DriverDashboard, DriverLocation, DriverShipment } from '@/src/lib/api';

export function locationCoordinate(location: Pick<DriverLocation, 'latitude' | 'longitude'> | null | undefined) {
  if (location?.latitude == null || location.longitude == null || String(location.latitude).trim() === '' || String(location.longitude).trim() === '') return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { latitude, longitude } : null;
}

export function runMapStops(shipments: DriverShipment[]) {
  return shipments.flatMap((shipment, index) => {
    const coordinate = locationCoordinate(shipment.dropoff_location);
    return coordinate ? [{ coordinate, number: index + 1, shipment }] : [];
  });
}

/** Keep co-located shipments visible instead of stacking markers on top of one another. */
export function groupRunMapStops(stops: ReturnType<typeof runMapStops>) {
  const groups = new Map<string, { coordinate: { latitude: number; longitude: number }; stops: typeof stops }>();
  for (const stop of stops) {
    const key = `${stop.coordinate.latitude},${stop.coordinate.longitude}`;
    const group = groups.get(key) ?? { coordinate: stop.coordinate, stops: [] };
    group.stops.push(stop);
    groups.set(key, group);
  }
  return [...groups.values()];
}


const normalized = (value: string | null | undefined) => value?.trim().replace(/\s+/g, ' ').toLocaleLowerCase() || '';

/** Older timelines omit coordinates; reuse only an exact, unambiguous authorized location match. */
export function stopCoordinate(stop: RunStop | null, shipments: DriverShipment[], endpoints: DriverDashboard['trip_endpoints'] = []) {
  const direct = locationCoordinate(stop);
  if (direct || !stop || stop.kind === 'Speeding' || stop.latitude !== undefined || stop.longitude !== undefined) return direct;
  const name = normalized(stop.name);
  const address = normalized(stop.address);
  if (!name || !address) return null;
  const linkedIds = new Set(stop.shipments?.map(shipment => shipment.shipment_id));
  const candidates = [
    ...shipments.filter(shipment => linkedIds.has(shipment.shipment_id)).flatMap(shipment => [shipment.pickup_location, shipment.dropoff_location]).filter(location => !!location).map(location => ({ ...location!, address: location!.full_address })),
    ...(endpoints ?? []),
  ].filter(location => normalized(location.name) === name && normalized(location.address) === address);
  const coordinates = candidates.map(locationCoordinate).filter(coordinate => coordinate !== null);
  if (!coordinates.length || coordinates.length !== candidates.length) return null;
  const first = coordinates[0];
  return coordinates.every(coordinate => coordinate.latitude === first.latitude && coordinate.longitude === first.longitude) ? first : null;
}
