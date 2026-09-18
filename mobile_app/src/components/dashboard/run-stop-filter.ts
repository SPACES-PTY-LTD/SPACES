import type { DriverDashboard } from '@/src/lib/api';

type RunStop = NonNullable<DriverDashboard['recorded_stops']>[number];

export function filterRunStops(stops: RunStop[], filter: 'all' | 'shipments' | 'speeding') {
  if (filter === 'speeding') return stops.filter(stop => stop.kind === 'Speeding');
  return filter === 'all' ? stops : stops.filter(stop => (stop.shipments?.length ?? 0) > 0 && (stop.kind ?? '').toLowerCase().includes('delivery'));
}
