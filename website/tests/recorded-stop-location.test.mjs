import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/runs/recorded-stop-location.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { recordedStopCoordinates, recordedStopLocationValues } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("preserve observation coordinates, including zero, without mixing coordinate pairs", () => {
  assert.deepEqual(recordedStopCoordinates({ latitude: 0, longitude: 0, location: { latitude: -26, longitude: 28 } }), { lat: 0, lng: 0 })
  assert.deepEqual(recordedStopCoordinates({ latitude: -26, location: { latitude: -27, longitude: 29 } }), { lat: -27, lng: 29 })
  for (const latitude of [null, undefined, NaN, Infinity, 91, -91]) {
    assert.equal(recordedStopCoordinates({ latitude, longitude: 28 }), null)
  }
  assert.equal(recordedStopCoordinates({ latitude: -26, longitude: 181 }), null)
})

const address = {
  formatted_address: "12 Main Road, Test City",
  place_id: "address-place",
  geometry: { location: { lat: () => -25, lng: () => 27 } },
  address_components: Object.entries({ street_number: "12", route: "Main Road", subpremise: "Unit 2", sublocality_level_1: "Test Town", locality: "Test City", administrative_area_level_1: "Gauteng", country: "South Africa", postal_code: "2000" }).map(([type, value]) => ({ types: [type], long_name: value })),
}

test("prefill address components while retaining exact stop GPS and known details", () => {
  const values = recordedStopLocationValues({ latitude: -26.123456, longitude: 28.123456, location: { company: "Known company", city: "Known city", code: "CODE" } }, address)
  assert.equal(values.name, "Known company")
  assert.equal(values.city, "Known city")
  assert.equal(values.code, "CODE")
  assert.equal(values.address_line_1, "12 Main Road")
  assert.equal(values.address_line_2, "Unit 2")
  assert.equal(values.town, "Test Town")
  assert.equal(values.province, "Gauteng")
  assert.equal(values.country, "South Africa")
  assert.equal(values.post_code, "2000")
  assert.equal(values.google_place_id, "address-place")
  assert.equal(values.latitude, -26.123456)
  assert.equal(values.longitude, 28.123456)
})

test("failed lookup leaves unknown details blank without inventing a shipment name or geofence", () => {
  const values = recordedStopLocationValues({ latitude: -26, longitude: 28, shipment: { merchant_order_ref: "SHIP-123" } })
  assert.equal(values.name, "")
  assert.equal(values.address_line_1, "")
  assert.equal(values.google_place_id, "")
  assert.equal(values.latitude, -26)
  assert.equal(values.longitude, 28)
  assert.equal(values.location_type_id, undefined)
  assert.equal(values.polygon_bounds, undefined)
})
