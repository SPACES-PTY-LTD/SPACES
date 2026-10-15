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
  size(group:string) { return this.groups.get(group)?.size ?? 0; }
  slot(group: string,id: string) { let slots=this.groups.get(group); if(!slots){slots=new Map();this.groups.set(group,slots);} if(!slots.has(id)) slots.set(id,slots.size); return slots.get(id)!; }
}
export type Placement = { vehicle: MonitorVehicle; x:number; y?:number; z:number; rotation:number };
export type SitePlacement = MonitorLocation & { x:number; z:number; direction:number; roadZ:number; block?:number };
export function layoutFleet(fleet: MonitorVehicle[], registry: SlotRegistry, roadLayout:'single'|'multiple'|'mixed'='single') {
  const locations=locationsFor(fleet);
  // Reserve slots before sizing the yards so refreshes cannot shrink across survivors.
  for(const vehicle of fleet) if(vehicle.status==='at_location' && vehicle.locationId) registry.slot(vehicle.locationId,vehicle.id);
  const maxYardRows=Math.max(1,...locations.map(l=>Math.ceil(registry.size(l.id)/5)));
  const roadZ=Math.max(10,3.4+(maxYardRows-1)*3+4.5);
  for(const location of locations) registry.slot('locations',location.id);
  const columns=Math.max(2,Math.ceil(Math.sqrt(registry.size('locations'))));
  const streetSpacing=roadZ+12;
  const mixedSlots:{x:number;row:number;z:number;block:number}[]=[];
  const crossStreets:{x:number;from:number;to:number}[]=[];
  const mixedRoads:number[]=[];
  let mixedZ=0;
  // Three blocks per row; rotate capacities without moving slots on refresh.
  for(let row=0;mixedSlots.length<registry.size('locations');row++){
    mixedRoads.push(mixedZ+roadZ);
    let x=-25.5;
    for(let block=0;block<3;block++){
      const capacity=[1,3,2][(row+block)%3];
      for(let column=0;column<capacity;column++)mixedSlots.push({x:x+column*17,row,z:mixedZ,block:row*3+block});
      x+=capacity*17+12;
      if(block<2 && row>0 && mixedSlots.length<registry.size('locations'))crossStreets.push({x:x-14.5,from:mixedRoads[row-1],to:mixedRoads[row]});
    }
    mixedZ+=streetSpacing+[0,5,2][row%3];
  }
  const network=roadLayout!=='single';
  const sites:SitePlacement[]=locations.map(l=>{
    const i=registry.slot('locations',l.id),mixed=mixedSlots[i];
    const direction=network?1:i%2===0?1:-1;
    const z=roadLayout==='mixed'?mixed.z:network?Math.floor(i/columns)*streetSpacing:direction===1?0:roadZ*2;
    const column=network?i%columns:Math.floor(i/2);
    return {...l,x:roadLayout==='mixed'?mixed.x:column*17-25.5,z,direction,block:roadLayout==='mixed'?mixed.block:undefined,roadZ:network?z+roadZ:roadZ};
  });
  const byId=new Map(sites.map(l=>[l.id,l]));
  const roads=roadLayout==='mixed'?(mixedRoads.length?mixedRoads:[roadZ]):network?Array.from({length:Math.max(1,Math.ceil(registry.size('locations')/columns))},(_,i)=>roadZ+i*streetSpacing):[roadZ];
  const parkingStart=network?roads[roads.length-1]+12:roadZ*2+12;
  const standbyRows=Math.max(1,Math.ceil(fleet.filter(v=>v.status==='standby').length/8));
  const placements=fleet.map(vehicle=>{
    if(vehicle.status==='at_location' && vehicle.locationId && byId.has(vehicle.locationId)){
      const site=byId.get(vehicle.locationId)!;const slot=registry.slot(vehicle.locationId,vehicle.id);
      // Rows grow away from the facility into its own extensible yard.
      return {vehicle,x:site.x+(slot%5-2)*2.1,z:site.z+site.direction*(3.4+Math.floor(slot/5)*3),rotation:-site.direction*Math.PI/2};
    }
    const slot=registry.slot(vehicle.status,vehicle.id);
    if(vehicle.status==='in_transit') return {vehicle,x:-31+(slot%16)*4,z:-12-Math.floor(slot/16)*2.4,rotation:0};
    const base=vehicle.status==='standby'?parkingStart:parkingStart+standbyRows*3+7;
    return {vehicle,x:14+(slot%8)*3.4,z:base+Math.floor(slot/8)*3,rotation:-Math.PI/2};
  });
  return {sites,placements,roadZ,roads,crossStreets:roadLayout==='mixed'?crossStreets:[]};
}

export type StreetJunction={x:number;z:number;kind:'signals'|'roundabout'|'bend';arms:number[]};
// Deterministic street furniture: keyed to road rows, never to animation frames or filters.
export function streetFurniture(roads:number[],minX:number,maxX:number,sites:SitePlacement[],placements:Placement[],crossStreets:{x:number;from:number;to:number}[] = []) {
  if(roads.length<2)return {junctions:[] as StreetJunction[],trees:[] as {x:number;z:number}[]};
  const junctions:StreetJunction[]=roads.flatMap((z,row)=>[minX,maxX].map((x,side)=>({
    x,z,kind:(row===roads.length-1 && side===0)||(row>0 && row%3===0 && side===1)?'roundabout' as const:'signals' as const,
    // Local +Z is the approach direction; right first junction also connects to the ramp.
    arms:[side===0?Math.PI/2:-Math.PI/2,...(side===1 && row===0?[Math.PI/2]:[]),...(row>0?[Math.PI]:[]),...(row<roads.length-1?[0]:[])],
  })));
  for(const street of crossStreets)for(const [z,arm] of [[street.from,0],[street.to,Math.PI]]){
    const existing=junctions.find(j=>j.x===street.x && j.z===z);
    if(existing){if(!existing.arms.includes(arm))existing.arms.push(arm);}
    else junctions.push({x:street.x,z,kind:(Math.round(street.x*2)+Math.round(z*2))%3===0?'roundabout':'signals',arms:[Math.PI/2,-Math.PI/2,arm]});
  }
  for(const junction of junctions) if(junction.kind==='signals' && junction.arms.length===2) junction.kind='bend';
  const trees:{x:number;z:number}[]=[];
  for(let row=0;row<roads.length-1;row++){
    const gap=roads[row+1]-roads[row],count=Math.max(1,Math.floor(gap/10));
    for(let i=0;i<count;i++) for(const x of [minX-6,maxX+6]){
      const z=roads[row]+gap*(i+1)/(count+1);
      if(junctions.every(j=>Math.hypot(x-j.x,z-j.z)>6.5) && sites.every(s=>Math.hypot(x-s.x,z-s.z)>8) && placements.every(p=>Math.hypot(x-p.x,z-p.z)>4))trees.push({x,z});
    }
  }
  return {junctions,trees};
}
