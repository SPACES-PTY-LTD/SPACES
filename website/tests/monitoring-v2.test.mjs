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
