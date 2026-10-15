import type { VehicleActivity } from '@/lib/types';

export type MonitorStatus = 'in_transit' | 'at_location' | 'standby' | 'unknown';
export type MonitorView = 'overview' | 'vehicle' | 'location' | 'attention' | 'shipment' | 'standby';
export type CameraView = 'overview' | 'road' | 'top';
export type MonitorVehicle = {
  id: string; plate: string; status: MonitorStatus; locationId: string | null;
  locationName: string; address: string; icon: string; allowance: number | null;
  since: number | null; observedAt: string | null; speed: number | null; limit: number | null;
  latitude: number | null; longitude: number | null; speeding: boolean;
  driver: string; telephone: string | null; shipmentId: string | null; shipmentRef: string | null;
  activity: VehicleActivity;
};
export type MonitorLocation = { id: string; name: string; address: string; icon: string; vehicles: MonitorVehicle[] };
export const statusLabels: Record<MonitorStatus, string> = { in_transit: 'In transit', at_location: 'At locations', standby: 'Standby', unknown: 'Unknown location' };
export function finite(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
export function timestamp(value?: string | null): number | null { const n = value ? Date.parse(value) : NaN; return Number.isFinite(n) ? n : null; }
export function validCoordinates(lat: unknown, lng: unknown): boolean { return finite(lat) !== null && finite(lng) !== null && Math.abs(lat as number) <= 90 && Math.abs(lng as number) <= 180; }
export function normalizeFleet(rows: VehicleActivity[]): MonitorVehicle[] {
  const vehicles = new Map<string, MonitorVehicle>();
  for (const row of rows) {
    const id = row.vehicle?.vehicle_id ?? row.vehicle_id;
    if (!id) continue;
    const m = row.monitoring;
    const loc = m?.location;
    const status = m?.status === 'at_location' && !loc?.location_id ? 'unknown' : m?.status ?? 'unknown';
    const driver = row.driver ?? row.vehicle?.last_driver;
    const speed = finite(row.speed_kph), limit = finite(row.speed_limit_kph);
    const explicit = row.metadata?.is_speeding;
    const allowance = finite(loc?.expected_waiting_time);
    vehicles.set(id, { id, plate: row.vehicle?.plate_number || row.vehicle?.ref_code || id,
      status, locationId: loc?.location_id ?? null, locationName: loc?.name || loc?.company || loc?.code || 'Unknown location',
      address: loc?.full_address || [loc?.city, loc?.province].filter(Boolean).join(', '), icon: loc?.type?.icon || 'warehouse',
      allowance: allowance !== null && allowance >= 0 ? allowance * 60000 : null, since: timestamp(m?.since_at),
      observedAt: row.occurred_at ?? null, speed, limit,
      latitude: finite(row.latitude), longitude: finite(row.longitude),
      speeding: typeof explicit === 'boolean' ? explicit : speed !== null && limit !== null && speed > limit,
      driver: driver?.name || 'Driver unavailable', telephone: driver?.telephone ?? null,
      shipmentId: row.shipment?.shipment_id ?? null, shipmentRef: row.shipment?.merchant_order_ref ?? null, activity: row });
  }
  return [...vehicles.values()].sort((a,b) => a.id.localeCompare(b.id));
}
export function waiting(vehicle: MonitorVehicle, now: number) {
  const atStop = vehicle.status === 'at_location' || vehicle.status === 'standby';
  const elapsed = atStop && vehicle.since !== null && vehicle.since <= now ? now - vehicle.since : null;
  const overdue = elapsed !== null && vehicle.allowance !== null && elapsed > vehicle.allowance;
  return { elapsed, overdue, excess: overdue ? elapsed! - vehicle.allowance! : 0 };
}
export function locationsFor(fleet: MonitorVehicle[]): MonitorLocation[] {
  const map = new Map<string, MonitorLocation>();
  for (const v of fleet) {
    if (!v.locationId || !['at_location','standby'].includes(v.status)) continue;
    if (!map.has(v.locationId)) map.set(v.locationId, { id:v.locationId, name:v.locationName, address:v.address, icon:v.icon, vehicles:[] });
    map.get(v.locationId)!.vehicles.push(v);
  }
  return [...map.values()];
}
export function duration(ms: number | null): string {
  if (ms === null) return 'Unavailable';
  if (ms > 0 && ms < 60000) return '<1 min';
  const min = Math.floor(ms / 60000);
  if (min >= 1440) return `${Math.floor(min / 1440)}d ${Math.floor(min % 1440 / 60)}h`;
  return min >= 60 ? `${Math.floor(min / 60)}h ${min % 60}m` : `${min} min`;
}
export function clockTime(value?: string | null) { const t=timestamp(value); return t === null ? 'Unavailable' : new Intl.DateTimeFormat(undefined,{hour:'2-digit',minute:'2-digit'}).format(t); }
export function eventName(event?: string) { return (event || 'Reported event').replaceAll('_',' ').replace(/^./,s=>s.toUpperCase()); }
export type FleetFilter = { search: string; status: string; location: string; type: string; alert: string };
export function filterFleet(fleet: MonitorVehicle[], f: FleetFilter, now: number) {
  return fleet.filter(v => (!f.search || v.plate.toLowerCase().includes(f.search.toLowerCase())) &&
    (!f.status || v.status === f.status) && (!f.location || v.locationId === f.location) &&
    (!f.type || v.icon === f.type) && (!f.alert || (f.alert === 'speeding' ? v.speeding : f.alert === 'waiting' ? waiting(v,now).overdue : v.speeding || waiting(v,now).overdue)));
}
// Slots are retained for the lifetime of a merchant workspace, including filtered vehicles.
export class SlotRegistry {
  private groups = new Map<string, Map<string,number>>();
  slot(group: string,id: string) { let slots=this.groups.get(group); if(!slots){slots=new Map();this.groups.set(group,slots);} if(!slots.has(id)) slots.set(id,slots.size); return slots.get(id)!; }
}
export type Placement = { vehicle: MonitorVehicle; x:number; z:number; rotation:number };
export type SitePlacement = MonitorLocation & { x:number; z:number };
export function layoutFleet(fleet: MonitorVehicle[], registry: SlotRegistry) {
  const locations=locationsFor(fleet);
  const sites=locations.map(l=>{const i=registry.slot('locations',l.id);return {...l,x:i*17-25.5,z:0};});
  const byId=new Map(sites.map(l=>[l.id,l]));
  const maxYardRows=Math.max(1,...sites.map(s=>Math.ceil(s.vehicles.filter(v=>v.status==='at_location').length/5)));
  const parkingStart=Math.max(16,6+maxYardRows*3+7);
  const standbyRows=Math.max(1,Math.ceil(fleet.filter(v=>v.status==='standby').length/8));
  const placements=fleet.map(vehicle=>{
    if(vehicle.status==='at_location' && vehicle.locationId && byId.has(vehicle.locationId)){
      const site=byId.get(vehicle.locationId)!;const slot=registry.slot(vehicle.locationId,vehicle.id);
      // Rows grow away from the facility into its own extensible yard.
      return {vehicle,x:site.x+(slot%5-2)*2.1,z:site.z+3.4+Math.floor(slot/5)*3,rotation:-Math.PI/2};
    }
    const slot=registry.slot(vehicle.status,vehicle.id);
    if(vehicle.status==='in_transit') return {vehicle,x:-31+(slot%16)*4,z:-12-Math.floor(slot/16)*2.4,rotation:0};
    const base=vehicle.status==='standby'?parkingStart:parkingStart+standbyRows*3+7;
    return {vehicle,x:14+(slot%8)*3.4,z:base+Math.floor(slot/8)*3,rotation:-Math.PI/2};
  });
  return {sites,placements};
}
