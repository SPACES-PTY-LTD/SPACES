import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const source = await readFile(new URL("../src/lib/admin-run-import.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { extractedRows, hasMapPosition, eligibleManualShipment, validateDocumentFile, emptyRunDraft } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
test("document validation permits only supported files within the limit", () => {
  assert.equal(validateDocumentFile({ name:"note.pdf",type:"application/pdf",size:20*1024*1024 }), "")
  for (const file of [{name:"note.pdf",type:"application/pdf",size:20*1024*1024+1},{name:"note.svg",type:"image/svg+xml",size:10},{name:"note.exe",type:"image/png",size:10}]) assert.ok(validateDocumentFile(file))
})
test("manual attachment excludes terminal shipments and active run assignments", () => {
  for (const status of ["delivered", "failed", "cancelled", "returned"]) assert.equal(eligibleManualShipment({ status }), false)
  for (const run_status of ["draft", "dispatched", "in_progress"]) assert.equal(eligibleManualShipment({ status:"booked",run_id:"run-1",run_status,run_shipment_status:"planned" }), false)
  assert.equal(eligibleManualShipment({ status:"booked" }), true)
  assert.equal(eligibleManualShipment({ status:"booked", run_id:"run-1",run_status:"draft",run_shipment_status:"removed" }), true)
})
test("trip endpoints require actual coordinates and accept zero", () => {
  for (const location of [null, {}, {latitude:null,longitude:0},{latitude:0,longitude:undefined},{latitude:"bad",longitude:0}]) assert.equal(hasMapPosition(location),false)
  assert.equal(hasMapPosition({latitude:0,longitude:0}),true)
})
test("extracted shipments retain quantities and instructions without inventing saved locations", () => {
  const rows=extractedRows({collection_date:"2026-10-13T00:00:00Z",pickup_instructions:"Dispatch",line_items:[{merchant_order_ref:"A",description:"Boxes",quantity:3},{merchant_order_ref:"B",quantity:0}]})
  assert.equal(rows[0].quantity,3);assert.equal(rows[0].collection_date,"2026-10-13");assert.equal(rows[0].quantity_unit,"units");assert.equal(rows[0].pickup_instructions,"Dispatch");assert.equal(rows[0].pickup_location_id,undefined)
  assert.equal(rows[1].quantity,0)
  assert.equal(extractedRows({line_items:[]}).length,1)
  assert.deepEqual(emptyRunDraft().shipment_ids,[])
})
