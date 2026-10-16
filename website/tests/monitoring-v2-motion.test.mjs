import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/admin/logistics/shipments/monitoring_v2/vehicle-motion.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {VehicleMotion}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const site={x:0,z:0,roadZ:16,direction:1};
const bay={vehicle:{id:'a',status:'at_location',locationId:'yard'},x:0,z:3.4,rotation:-Math.PI/2};
const road={vehicle:{id:'a',status:'in_transit',locationId:null},x:-30,y:8,z:-12,rotation:0};
function settle(m,p=bay,s=site,visible=true){let r;for(let i=0;i<240;i++)r=m.step(p,s,visible,.05,false,false);return r;}
test('arrival starts at road and reaches bay through side aisle',()=>{const m=new VehicleMotion();let r=m.step(bay,site,true,0,false,false);assert.deepEqual(r.position,{x:6,y:0,z:16});r=settle(m);assert.deepEqual(r.position,{x:0,y:0,z:3.4});assert.equal(r.rotation,bay.rotation);});
test('departure stays visible through status filter and never flies toward elevated road',()=>{const m=new VehicleMotion();settle(m);const r=m.step(road,undefined,false,.05,false,false);assert.equal(r.visible,true);assert.equal(r.position.y,0);assert.ok(r.position.x>0);const end=settle(m,road,undefined,false);assert.equal(end.visible,false);assert.deepEqual(end.position,{x:-30,y:8,z:-12});});
test('pause freezes motion and reduced motion settles immediately',()=>{const m=new VehicleMotion();const a=m.step(bay,site,true,.05,false,false);const b=m.step(bay,site,true,.05,true,false);assert.deepEqual(a.position,b.position);assert.deepEqual(m.step(bay,site,true,.05,true,true).position,{x:0,y:0,z:3.4});});
test('filter and layout changes do not replay arrivals',()=>{const m=new VehicleMotion();settle(m);assert.equal(m.step(bay,site,false,.05,false,false).visible,false);assert.deepEqual(m.step(bay,site,true,.05,false,false).position,{x:0,y:0,z:3.4});const moved={...bay,x:20};assert.deepEqual(m.step(moved,{...site,x:20},true,.05,false,false).position,{x:20,y:0,z:3.4});});
test('opposite-side yards use their own road entrance',()=>{const m=new VehicleMotion();const p={...bay,z:-3.4,rotation:Math.PI/2};const s={...site,roadZ:-16,direction:-1};assert.equal(m.step(p,s,true,0,false,false).position.z,-16);assert.equal(settle(m,p,s).position.z,-3.4);});
test('animation work stops at rest but continues for filtered departures',()=>{
 const m=new VehicleMotion();
 assert.equal(m.isAnimating('a'),false);
 m.step(bay,site,true,0,false,false);assert.equal(m.isAnimating('a'),true);
 settle(m);assert.equal(m.isAnimating('a'),false);
 m.step(road,undefined,false,.05,false,false);assert.equal(m.isAnimating('a'),true);
 settle(m,road,undefined,false);assert.equal(m.isAnimating('a'),false);
 m.prune(new Set());assert.equal(m.isAnimating('a'),false);
});
test('Mini arrival and departure use road approach and the explicit side aisle',()=>{
 const m=new VehicleMotion(),s={x:0,z:0,roadZ:-6,direction:1,entrance:{x:6,z:-6},aisleOffset:1.65};
 const p={...bay,x:9.5,z:5.4,rotation:0};
 let r=m.step(p,s,true,0,false,false);assert.deepEqual(r.position,{x:6,y:0,z:-6});
 for(let i=0;i<160;i++){
  r=m.step(p,s,true,.05,false,false);
  assert.ok(r.position.z===-6 || Math.abs(r.position.x-11.15)<.001 || r.position.z===5.4,'moves along approach, aisle, then bay');
 }
 assert.deepEqual(r.position,{x:9.5,y:0,z:5.4});
 const departure=m.step(road,undefined,false,.05,false,false);assert.ok(departure.position.x>9.5);assert.equal(departure.visible,true);
});
