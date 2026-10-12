import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const root = new URL("../src/app/admin/logistics/shipments/monitoring/", import.meta.url)
async function load(path, replacements = {}) {
  let source = await readFile(new URL(path, root), "utf8")
  for (const [from, to] of Object.entries(replacements)) source = source.replaceAll(`"${from}"`, `"${to}"`)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
}
const { getTruckBodyColour: colour } = await load("truck-appearance.ts")
const { REFINED_TRUCK_GEOMETRIES: geometry } = await load("components/refined-truck-geometry.ts", Object.fromEntries([
  ["three", "build/three.module.js"],
  ["three/examples/jsm/geometries/RoundedBoxGeometry.js", "examples/jsm/geometries/RoundedBoxGeometry.js"],
  ["three/examples/jsm/utils/BufferGeometryUtils.js", "examples/jsm/utils/BufferGeometryUtils.js"],
].map(([from, path]) => [from, new URL(`../node_modules/three/${path}`, import.meta.url).href])))

test("alerts override selection; hover lightens alerts without changing their meaning", () => {
  for (const alert of [{ isSpeeding: true }, { isWaitingOverdue: true }, { speedKph: 81, speedLimitKph: 80 }]) {
    assert.equal(colour(alert, true, false), "#ef4444")
    assert.equal(colour(alert, true, true), "#f87171")
  }
  assert.equal(colour({}, true, true), "#2563eb")
  assert.equal(colour({}, false, true), "#9ca3af")
  assert.equal(colour({}, false, false), "#999999")
})
test("speed boundary, missing telemetry and explicit false retain existing rules", () => {
  for (const state of [{ speedKph: 80, speedLimitKph: 80 }, { speedKph: 81 }, { speedKph: null, speedLimitKph: 80 }, { speedKph: 0, speedLimitKph: 0 }, { isSpeeding: false, speedKph: 81, speedLimitKph: 80 }]) assert.equal(colour(state, false, false), "#999999")
  assert.equal(colour({ speedKph: 1, speedLimitKph: 0 }, false, false), "#ef4444")
})
test("all material batches fit existing road/location hitboxes with finite geometry", () => {
  assert.equal(Object.keys(geometry).length, 7)
  for (const [name, part] of Object.entries(geometry)) {
    const { min, max } = part.boundingBox
    assert.ok(min.x >= -1.3 && max.x <= 1.3, `${name} length`)
    assert.ok(min.y >= -.05 && max.y <= 1.15, `${name} height`)
    assert.ok(min.z >= -.65 && max.z <= .65, `${name} width`)
    assert.ok(part.attributes.position.count > 0)
    for (const attribute of [part.attributes.position, part.attributes.normal]) assert.ok(Array.from(attribute.array).every(Number.isFinite), name)
  }
  assert.ok(geometry.painted.boundingBox.min.x < -1 && geometry.painted.boundingBox.max.x > 1, "cab and cargo share dynamic paint")
})
