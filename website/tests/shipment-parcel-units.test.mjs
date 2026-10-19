import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const source = await readFile(new URL("../src/lib/shipment-parcel-units.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { shipmentParcelPayload: payload, parcelEditorMetadata: metadata, restoreParcelLines: restore, parcelMeasurements: fields, parcelQuantityError: error } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const line = { title: "Goods", quantity: "2", quantity_unit: "boxes", weight_kg: 3, length_cm: 10, width_cm: 20, height_cm: 30 }
test("measurement visibility matches mobile units", () => {
 for (const unit of ["boxes", "pallets", "crates"]) assert.deepEqual(fields(unit), { weight: true, dimensions: true })
 for (const unit of ["bags", "drums", "rolls", "liters", "cubic_metres"]) assert.deepEqual(fields(unit), { weight: true, dimensions: false })
 for (const unit of ["units", "kilograms", "tonnes"]) assert.deepEqual(fields(unit), { weight: false, dimensions: false })
})
test("packaging expands while measured units preserve one parcel and convert mass", () => {
 assert.equal(payload([line]).length, 2)
 assert.equal(payload([{ ...line, quantity: "1.25", quantity_unit: "tonnes" }])[0].weight, 1250)
 assert.equal(payload([{ ...line, quantity: "2.5", quantity_unit: "liters" }]).length, 1)
})
test("reject invalid quantities and excessive expanded counts", () => {
 for (const quantity of ["", "0", "-1", "2.5", "101", "NaN"]) assert.ok(error([{ ...line, quantity }]))
 assert.ok(error(Array.from({length:6}, () => ({ ...line, quantity: 100 }))))
 assert.ok(error([{ ...line, quantity_unit: "tonnes", quantity: 10000 }]))
})
test("saved lines round-trip without clobbering metadata or stale parcel changes", () => {
 const meta = metadata([line], { source: "import" })
 assert.equal(meta.source, "import")
 assert.deepEqual(restore(payload([line]), meta), [line])
 assert.equal(restore([{ ...payload([line])[0], contents_description: "Changed" }], meta)[0].title, "Changed")
 assert.equal(payload([{ ...line, quantity_unit: "units" }])[0].weight, 3)
})

test("mobile import quantities restore only when matching stored parcels", () => {
 const meta = { delivery_note_items: [{ quantity: 2, quantity_unit: "boxes" }] }
 assert.equal(restore(payload([line]), meta)[0].quantity, 2)
 assert.equal(restore(payload([line]), meta)[0].quantity_unit, "boxes")
 assert.equal(restore(payload([line]), { delivery_note_items: [{ quantity: 3, quantity_unit: "boxes" }] }).length, 2)
})
