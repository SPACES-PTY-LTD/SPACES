import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/runs/run-map-markers.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { buildRunMapMarkers, elapsed, markerDetails, markerAppearance, latestStopMarker, visibleRunMapMarkers } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const start = "2026-09-21T08:00:00Z", end = "2026-09-21T09:15:30Z"
const stop = { latitude: -26, longitude: 28, event_type: "stopped", occurred_at: start, vehicle: { vehicle_id: "truck" }, run_id: "run" }
const rows = marker => Object.fromEntries(marker.rows)

test("visit duration, category, address and shipment context survive marker creation", () => {
  const [marker] = buildRunMapMarkers([{ ...stop, entered_at: start, exited_at: end, speed_kph: 0, location: { name: "Depot", type: { title: "Collection point" }, full_address: "1 Main Road" }, shipment: { merchant_order_ref: "REF-1" } }], null)
  assert.equal(rows(marker)["Time at stop"], "1h 15m 30s")
  assert.equal(rows(marker)["Location category"], "Collection point")
  assert.equal(rows(marker).Address, "1 Main Road")
  assert.equal(rows(marker).Shipment, "REF-1")
  assert.equal(rows(marker)["Recorded speed"], "0 km/h")
})

test("missing, reversed and invalid times cannot fabricate stop duration", () => {
  assert.equal(elapsed(null, end), null)
  assert.equal(elapsed(end, start), null)
  assert.equal(elapsed("bad", end), null)
  assert.equal(elapsed(start, start), "0s")
  assert.match(rows(buildRunMapMarkers([stop], null)[0])["Time at stop"], /^Unknown/)
})

test("motion duration uses next transition from the same vehicle and run", () => {
  const moving = { ...stop, event_type: "moving", occurred_at: end }
  assert.match(rows(buildRunMapMarkers([stop], null, [moving])[0])["Time at stop"], /^1h 15m 30s \(estimated/)
  for (const unrelated of [{ ...moving, vehicle: { vehicle_id: "other" } }, { ...moving, run_id: "other" }, { ...moving, event_type: "stopped" }]) {
    assert.match(rows(buildRunMapMarkers([stop], null, [unrelated])[0])["Time at stop"], /^Unknown/)
  }
})

test("GPS stationary intervals are distinguished from confirmed visits and isolated positions", () => {
  const markers = buildRunMapMarkers([], { stops: [{ latitude: -26, longitude: 28, first_seen_at: start, last_seen_at: end, sample_count: 8 }], segments: [[{ latitude: -27, longitude: 29, observed_at: end }]] })
  assert.equal(rows(markers[0])["Observed stationary time"], "1h 15m 30s")
  assert.equal(rows(markers[0])["GPS samples"], "8")
  assert.match(rows(markers[1]).Context, /does not establish a stop/)
  assert.deepEqual(markers.map(marker => marker.type), ["stationary_gps", "recorded_position"])
})

test("missing and invalid coordinates are omitted without renumbering stops", () => {
  const markers = buildRunMapMarkers([{ ...stop, latitude: null }, { ...stop, latitude: 91 }, stop], null)
  assert.equal(markers.length, 1)
  assert.equal(markers[0].label, "3")
})

test("popup treats location text as text and retains overlapping events", () => {
  const original = globalThis.document
  globalThis.document = { createElement: tag => ({ tag, style: {}, children: [], append(...children) { this.children.push(...children) }, set innerHTML(_) { throw Error("Unsafe HTML") } }) }
  try {
    const markers = buildRunMapMarkers([{ ...stop, location: { name: '<img src=x onerror="alert(1)">' } }, stop], null)
    const content = markerDetails(markers)
    assert.equal(content.children.length, 2)
    assert.match(content.children[0].children[0].textContent, /<img src=x/)
  } finally { globalThis.document = original }
})


test("latest stop follows recorded chronology, ignoring speed and GPS positions", () => {
  const markers = buildRunMapMarkers([{ ...stop, occurred_at: end }, stop, { ...stop, occurred_at: "invalid" }], null)
  markers.push({ type: "speeding", observedAt: "2026-09-22T00:00:00Z" })
  markers.push({ type: "recorded_position", observedAt: "2026-09-23T00:00:00Z" })
  assert.equal(latestStopMarker(markers), markers[0])
  assert.equal(latestStopMarker([{ ...markers[0], observedAt: null }]), null)
})

test("speeding activities appear once and use a distinct warning colour", () => {
  const speeding = { ...stop, activity_id: "speed-1", event_type: "speeding", speed_kph: 100 }
  assert.equal(buildRunMapMarkers([speeding], null, [speeding]).length, 1)
  const markers = buildRunMapMarkers([stop], null, [speeding])
  assert.equal(markers[1].type, "speeding")
  assert.equal(markers[1].label, undefined)
  assert.equal(markerAppearance("speeding").color, "#dc2626")
  assert.notEqual(markerAppearance("shipment_collection").color, markerAppearance("shipment_delivery").color)
})

test("coincident observations share a pin while filters reveal remaining types", () => {
  const markers = buildRunMapMarkers([stop, { ...stop, event_type: "shipment_collection" }], null)
  const gps = { ...markers[0], type: "recorded_position" }
  const nearby = { ...gps, position: { lat: -26.000001, lng: 28 } }
  const all = [gps, ...markers, nearby]
  assert.deepEqual([...visibleRunMapMarkers(all)], [markers[0], nearby])
  assert.deepEqual([...visibleRunMapMarkers(all, ["stopped"])], [markers[1], nearby])
  assert.deepEqual([...visibleRunMapMarkers(all, ["stopped", "shipment_collection"])], [gps, nearby])
  assert.equal(all.length, 4)
  assert.equal(visibleRunMapMarkers(all, ["stopped", "shipment_collection", "recorded_position"]).size, 0)
  const car = { ...markers[0], type: "latest_stop" }
  assert.deepEqual([...visibleRunMapMarkers([...all, car])], [car, nearby])
  assert.deepEqual([...visibleRunMapMarkers([...all, car], [], true)], [markers[0], nearby])
})
