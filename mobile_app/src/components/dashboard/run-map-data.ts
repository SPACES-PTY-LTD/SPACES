import type { DriverLocation, DriverShipment } from '@/src/lib/api';

export function locationCoordinate(location: DriverLocation | null | undefined) {
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
