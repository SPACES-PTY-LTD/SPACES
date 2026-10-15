import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';
const source=await readFile(new URL('../src/app/admin/logistics/shipments/monitoring_v2/highway.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {rampSection,HIGHWAY_HEIGHT}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('ramp meets both road surfaces with level tangent and no height discontinuity',()=>{
 for(const front of [10,25,100]){
  const start=rampSection(0,front,-12,5),end=rampSection(1,front,-12,5);
  assert.ok(Math.abs(start.x)<1e-10 && Math.abs(end.x)<1e-10);
  assert.equal(start.z,front);assert.equal(end.z,-12);
  assert.equal(start.y,0);assert.equal(end.y,HIGHWAY_HEIGHT);
  assert.equal(start.width,5);assert.equal(end.width,5);
  const step=.00001;
  assert.ok((rampSection(step,front,-12,5).y-start.y)/step<.001);
  assert.ok((end.y-rampSection(1-step,front,-12,5).y)/step<.001);
  let previous=0;
  for(let i=0;i<=96;i++){const p=rampSection(i/96,front,-12,5);assert.ok(p.y>=previous && p.y<=HIGHWAY_HEIGHT);assert.ok(p.x>=0);previous=p.y;}
 }
});
