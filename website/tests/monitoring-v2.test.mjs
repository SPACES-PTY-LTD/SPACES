import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/admin/logistics/shipments/monitoring_v2/model.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const m=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const now=Date.parse('2026-10-15T10:42:00Z');
function row(id,status='at_location',extras={}){return {vehicle:{vehicle_id:id,plate_number:id},monitoring:{status,since_at:new Date(now-60000).toISOString(),location:{location_id:'depot',name:'Depot',expected_waiting_time:1}},...extras};}
test('one vehicle per identity; no fabricated GPS or shipment',()=>{
 const fleet=m.normalizeFleet([row('a'),row('a'),{vehicle:{vehicle_id:'b'}},{}]);
 assert.equal(fleet.length,2);assert.equal(fleet[1].status,'unknown');assert.equal(fleet[1].latitude,null);assert.equal(fleet[1].shipmentId,null);
 assert.equal(m.validCoordinates(null,null),false);assert.equal(m.validCoordinates(0,0),true);assert.equal(m.validCoordinates(NaN,22),false);assert.equal(m.validCoordinates(91,0),false);
});
test('waiting boundaries, absent/future times, zero allowance, and standby',()=>{
 const [v]=m.normalizeFleet([row('a')]);assert.equal(m.waiting(v,now).overdue,false);assert.equal(m.waiting(v,now+1).overdue,true);
 assert.equal(m.waiting({...v,allowance:0},now).overdue,true);assert.equal(m.waiting({...v,since:null},now).elapsed,null);
 assert.equal(m.waiting({...v,since:now+1},now).overdue,false);assert.equal(m.waiting({...v,status:'standby'},now+1).overdue,true);
 for(const status of ['in_transit','unknown'])assert.equal(m.waiting({...v,status},now+1).overdue,false);
 assert.equal(m.waiting({...v,allowance:null},now+1).overdue,false);
});
test('explicit speeding false overrides comparison and absent speed never alerts',()=>{
 const fleet=m.normalizeFleet([row('a','in_transit',{speed_kph:81,speed_limit_kph:80,metadata:{is_speeding:false}}),row('b','in_transit',{speed_kph:81,speed_limit_kph:80}),row('c','in_transit',{speed_kph:null,speed_limit_kph:80})]);assert.deepEqual(fleet.map(v=>v.speeding),[false,true,false]);
});
test('filter composition and overlapping alerts count each vehicle once',()=>{
 const fleet=m.normalizeFleet([row('GP 123','standby',{speed_kph:90,speed_limit_kph:80}),row('GP 456')]);const base={search:'',status:'',location:'',type:'',alert:'any'};
 const matches=m.filterFleet(fleet,{...base,search:'gp 12'},now+1);assert.equal(matches.length,1);assert.equal(matches[0].id,'GP 123');
 assert.equal(m.filterFleet(fleet,{...base,search:'gp',status:'in_transit'},now+1).length,0);assert.equal(m.locationsFor(fleet)[0].vehicles.length,2);
});
test('105, 500 and 1000 trucks each get a unique position without aggregation',()=>{
 for(const n of [105,500,1000]){const fleet=m.normalizeFleet(Array.from({length:n},(_,i)=>row(String(i),['at_location','in_transit','standby','unknown'][i%4])));const layout=m.layoutFleet(fleet,new m.SlotRegistry());assert.equal(layout.placements.length,n);assert.equal(new Set(layout.placements.map(p=>`${p.x}:${p.z}`)).size,n);assert.ok(layout.placements.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z)));}
});
test('poll reorder and removals preserve surviving slots',()=>{
 const registry=new m.SlotRegistry();const fleet=m.normalizeFleet([row('a'),row('b'),row('c','in_transit')]);const initial=m.layoutFleet(fleet,registry).placements;const next=m.layoutFleet([fleet[2],fleet[1]],registry).placements;for(const p of next){const before=initial.find(x=>x.vehicle.id===p.vehicle.id);assert.equal(p.x,before.x);assert.equal(p.z,before.z);}
});
test('locations pair across the road with inward yards and stable slots',()=>{
 const fleet=m.normalizeFleet(Array.from({length:240},(_,i)=>row(String(i),'at_location',{monitoring:{status:'at_location',location:{location_id:`site-${Math.floor(i/12)}`,name:`Site ${Math.floor(i/12)}`}}})));
 const registry=new m.SlotRegistry();const layout=m.layoutFleet(fleet,registry);
 assert.equal(new Set(layout.sites.map(s=>s.x)).size,10);
 assert.equal(layout.sites.filter(s=>s.z<layout.roadZ).length,10);
 assert.equal(layout.sites.filter(s=>s.z>layout.roadZ).length,10);
 for(const p of layout.placements){const site=layout.sites.find(s=>s.id===p.vehicle.locationId);assert.ok((p.z-site.z)*site.direction>0);assert.ok(Math.abs(p.z-layout.roadZ)>=4.5-1e-9);assert.equal(p.rotation,-site.direction*Math.PI/2);}
 const refreshed=m.layoutFleet([...fleet].reverse(),registry);
 assert.deepEqual(new Map(refreshed.sites.map(s=>[s.id,[s.x,s.z,s.direction]])),new Map(layout.sites.map(s=>[s.id,[s.x,s.z,s.direction]])));
});
test('multiple roads compact locations and keep yards clear and slots stable',()=>{
 const fleet=m.normalizeFleet(Array.from({length:240},(_,i)=>row(String(i),'at_location',{monitoring:{status:'at_location',location:{location_id:`site-${Math.floor(i/12)}`,name:`Site ${Math.floor(i/12)}`}}})));
 const registry=new m.SlotRegistry();const single=m.layoutFleet(fleet,registry);const multi=m.layoutFleet(fleet,registry,'multiple');
 assert.ok(multi.roads.length>1);
 assert.ok(Math.max(...multi.sites.map(s=>s.x))<Math.max(...single.sites.map(s=>s.x)));
 assert.equal(new Set(multi.placements.map(p=>`${p.x}:${p.z}`)).size,fleet.length);
 for(const p of multi.placements){const site=multi.sites.find(s=>s.id===p.vehicle.locationId);assert.ok(multi.roads.includes(site.roadZ));assert.ok(p.z>site.z);for(const z of multi.roads)assert.ok(Math.abs(p.z-z)>=4.5-1e-9);}
 const refreshed=m.layoutFleet([...fleet].reverse(),registry,'multiple');
 assert.deepEqual(new Map(refreshed.sites.map(s=>[s.id,[s.x,s.z]])),new Map(multi.sites.map(s=>[s.id,[s.x,s.z]])));
 assert.deepEqual(m.layoutFleet(fleet,registry).placements,single.placements);
});
test('street furniture follows road topology and keeps trees clear',()=>{
 for(const count of [0,1,4,20,60]){
  const fleet=m.normalizeFleet(Array.from({length:count},(_,i)=>row(String(i),'at_location',{monitoring:{status:'at_location',location:{location_id:`site-${i}`,name:`Site ${i}`}}})));
  const layout=m.layoutFleet(fleet,new m.SlotRegistry(),'multiple');const min=Math.min(-35,...layout.sites.map(s=>s.x-10)),max=Math.max(-16,...layout.sites.map(s=>s.x+10));
  const furniture=m.streetFurniture(layout.roads,min,max,layout.sites,layout.placements);
  assert.deepEqual(furniture,m.streetFurniture(layout.roads,min,max,layout.sites,layout.placements));
  assert.equal(furniture.junctions.length,layout.roads.length>1?layout.roads.length*2:0);
  if(layout.roads.length>1){assert.ok(furniture.junctions.some(j=>j.kind==='roundabout'));assert.ok(furniture.junctions.some(j=>j.kind==='signals'));}
  for(const j of furniture.junctions){assert.ok(layout.roads.includes(j.z));assert.equal(new Set(j.arms).size,j.arms.length);if(j.kind==='signals')assert.ok(j.arms.length>=3);}
  for(const t of furniture.trees){assert.ok(t.x<min-4 || t.x>max+4);assert.ok(furniture.junctions.every(j=>Math.hypot(t.x-j.x,t.z-j.z)>6.5));assert.ok(layout.placements.every(p=>Math.hypot(t.x-p.x,t.z-p.z)>4));}
 }
});
test('mixed blocks contain one to three locations with stable staggered placement',()=>{
 const fleet=m.normalizeFleet(Array.from({length:25},(_,i)=>row(String(i),'at_location',{monitoring:{status:'at_location',location:{location_id:`mixed-${i}`,name:`Mixed ${i}`}}})));
 const registry=new m.SlotRegistry(),layout=m.layoutFleet(fleet,registry,'mixed');
 const counts=layout.roads.map(z=>layout.sites.filter(s=>s.roadZ===z).length);
 assert.deepEqual(counts,[3,6,6,6,4]);
 const blocks=Map.groupBy(layout.sites,s=>s.block);
 assert.ok([...blocks.values()].every(b=>b.length>=1 && b.length<=3));
 assert.ok(layout.roads.length<=5);
 for(const street of layout.crossStreets){
   assert.ok(layout.roads.includes(street.from) && layout.roads.includes(street.to));
   for(const site of layout.sites)if(site.z>street.from && site.z<street.to)assert.ok(Math.abs(site.x-street.x)>9);
   for(const p of layout.placements)if(p.z>street.from && p.z<street.to)assert.ok(Math.abs(p.x-street.x)>4.5);
 }
 const furniture=m.streetFurniture(layout.roads,-35,100,layout.sites,layout.placements,layout.crossStreets);
 const internal=furniture.junctions.filter(j=>j.x!==-35 && j.x!==100);
 assert.ok(internal.some(j=>j.kind==='roundabout'));assert.ok(internal.some(j=>j.kind==='signals'));
 for(const street of layout.crossStreets)for(const z of [street.from,street.to])assert.ok(furniture.junctions.some(j=>j.x===street.x && j.z===z));
 assert.ok(new Set(layout.roads.slice(1).map((z,i)=>z-layout.roads[i])).size>1);
 assert.equal(new Set(layout.placements.map(p=>`${p.x}:${p.z}`)).size,25);
 for(const p of layout.placements)for(const z of layout.roads)assert.ok(Math.abs(p.z-z)>=4.5-1e-9);
 const updated=m.layoutFleet([...fleet].reverse(),registry,'mixed');
 assert.deepEqual(new Map(updated.sites.map(s=>[s.id,[s.x,s.z]])),new Map(layout.sites.map(s=>[s.id,[s.x,s.z]])));
});

test('small mixed grids use multiple road rows and remain stable as locations arrive',()=>{
 const fleet=m.normalizeFleet(Array.from({length:7},(_,i)=>row(String(i),'at_location',{monitoring:{status:'at_location',location:{location_id:`small-${i}`,name:`Small ${i}`}}})));
 for(const count of [4,5,6,7]){
  const registry=new m.SlotRegistry();
  const initial=m.layoutFleet(fleet.slice(0,count),registry,'mixed');
  assert.ok(initial.roads.length>=2);
  assert.ok(new Set(initial.sites.map(site=>site.z)).size>=2);
  const expanded=m.layoutFleet(fleet,registry,'mixed');
  for(const site of initial.sites){const next=expanded.sites.find(s=>s.id===site.id);assert.equal(next.x,site.x);assert.equal(next.z,site.z);}
 }
});
test('road markings stop at junction footprints, including overlapping and endpoint gaps',()=>{
 assert.deepEqual(m.roadMarkingSegments(-10,10,[{at:0,radius:2.6}]),[[-10,-2.6],[2.6,10]]);
 assert.deepEqual(m.roadMarkingSegments(-10,10,[{at:-10,radius:4.3},{at:10,radius:4.3}]),[[-5.7,5.7]]);
 assert.deepEqual(m.roadMarkingSegments(-10,10,[{at:0,radius:3},{at:2,radius:3}]),[[-10,-3],[5,10]]);
 assert.deepEqual(m.roadMarkingSegments(-2,2,[{at:0,radius:4.3}]),[]);
});

test('Mini fits 1, 4, 7 and 25 stable locations with 105 and 1000 side-parked vehicles',()=>{
 for(const count of [105,1000])for(const locations of [1,4,7,25]){
  const fleet=m.normalizeFleet(Array.from({length:count},(_,i)=>row(`v-${i}`,'at_location',{monitoring:{status:'at_location',location:{location_id:`l-${i%locations}`,name:`Location ${i%locations}`}}})));
  const registry=new m.SlotRegistry(),layout=m.layoutFleet(fleet,registry,'mini');
  assert.equal(layout.sites.length,locations);assert.equal(layout.placements.length,count);
  assert.ok(layout.crossStreets.every(c=>c.x<Math.max(...layout.sites.map(s=>s.x+s.yardWidth))),'no disconnected streets beyond partial blocks');
  assert.deepEqual(m.layoutFleet([...fleet].reverse(),registry,'mini').placements.slice().sort((a,b)=>a.vehicle.id.localeCompare(b.vehicle.id)),layout.placements);
  for(const p of layout.placements){
   const s=layout.sites.find(s=>s.id===p.vehicle.locationId);
   assert.ok(p.x-1>s.x+2.5,'parking clears building');
   assert.ok(p.x+1<s.x+s.yardWidth,'parking fits yard width');
   assert.ok(p.z+.5<s.z+s.yardDepth,'parking fits yard depth');
   assert.ok(layout.roads.every(z=>Math.abs(p.z-z)>2),'parking clears horizontal roads');
   assert.ok(layout.crossStreets.every(c=>p.z<c.from || p.z>c.to || Math.abs(p.x-c.x)>2),'parking clears cross streets');
  }
  const occupied=new Set(layout.placements.map(p=>`${p.x}:${p.z}`));assert.equal(occupied.size,count);
  for(let i=0;i<layout.placements.length;i++)for(let j=i+1;j<layout.placements.length;j++){
   const a=layout.placements[i],b=layout.placements[j];assert.ok(Math.abs(a.x-b.x)>2 || Math.abs(a.z-b.z)>1,'vehicles do not overlap');
  }
 }
});
test('Mini perimeter transit and standby/unknown areas remain separate',()=>{
 const fleet=m.normalizeFleet(Array.from({length:1000},(_,i)=>row(`v-${i}`,['in_transit','standby','unknown','at_location'][i%4])));
 const layout=m.layoutFleet(fleet,new m.SlotRegistry(),'mini');
 for(const p of layout.placements){
  if(p.vehicle.status==='in_transit')assert.ok(p.z<-10);
  if(['standby','unknown'].includes(p.vehicle.status))assert.ok(p.z>layout.roads.at(-1)+4);
 }
 assert.equal(new Set(layout.placements.map(p=>`${p.x}:${p.z}`)).size,1000);
});
