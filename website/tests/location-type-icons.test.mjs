import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/lib/location-type-icons.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { LOCATION_TYPE_ICONS, findLocationTypeIcon, getLocationTypeIconPreview, resolveLocationMeshType } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("every selectable persisted value resolves to its actual monitoring model", () => {
  assert.deepEqual(LOCATION_TYPE_ICONS.map((icon) => [icon.value, resolveLocationMeshType(icon.value)]), [
    ["warehouse", "warehouse"], ["workshop", "workshop"], ["waypoint", "waypoint"], ["restarea", "rest"], ["fuel", "fuel"],
    ...["container-terminal", "seaport", "airport-cargo", "rail-freight", "mine", "quarry", "factory", "farm", "grain-terminal", "cold-storage", "retail", "construction", "weighbridge", "border", "toll-plaza", "fuel-station-2", "fuel-depot"].map(value => [value, value]),
  ])
  assert.equal(resolveLocationMeshType(" FUEL "), "fuel")
  assert.equal(resolveLocationMeshType(" FUEL-STATION-2 "), "fuel-station-2")
})

test("legacy and empty values keep the existing warehouse fallback without being recognised as selections", () => {
  for (const value of [undefined, null, "", "coffee", "wrench", "navigation", "map-pin", "flag", "rest"]) {
    assert.equal(findLocationTypeIcon(value), undefined)
    assert.equal(getLocationTypeIconPreview(value).value, "warehouse")
    assert.equal(resolveLocationMeshType(value), "warehouse")
  }
})

test("every catalogue entry has a distinct 512 by 512 RGBA PNG asset", async () => {
  assert.equal(new Set(LOCATION_TYPE_ICONS.map((icon) => icon.image)).size, 22)
  for (const icon of LOCATION_TYPE_ICONS) {
    const png = await readFile(new URL(`../public${icon.image}`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), "PNG")
    assert.equal(png.readUInt32BE(16), 512)
    assert.equal(png.readUInt32BE(20), 512)
    assert.equal(png[25], 6)
  }
})

 test("every new selectable type has a registered 3D model, not a warehouse fallback", async () => {
  const models = await readFile(new URL("../src/app/admin/logistics/shipments/monitoring/components/additional-location-models.tsx", import.meta.url), "utf8")
  const registry = models.slice(models.indexOf("export const ADDITIONAL_LOCATION_MODELS"))
  for (const icon of LOCATION_TYPE_ICONS.slice(5)) assert.ok(registry.includes(`"${icon.meshType}":`) || registry.includes(`  ${icon.meshType}:`), icon.value)
})
