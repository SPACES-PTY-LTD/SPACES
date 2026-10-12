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
  ])
  assert.equal(resolveLocationMeshType(" FUEL "), "fuel")
})

test("legacy and empty values keep the existing warehouse fallback without being recognised as selections", () => {
  for (const value of [undefined, null, "", "coffee", "wrench", "navigation", "map-pin", "flag", "rest"]) {
    assert.equal(findLocationTypeIcon(value), undefined)
    assert.equal(getLocationTypeIconPreview(value).value, "warehouse")
    assert.equal(resolveLocationMeshType(value), "warehouse")
  }
})

test("every catalogue entry has a distinct 512 by 512 RGBA PNG asset", async () => {
  assert.equal(new Set(LOCATION_TYPE_ICONS.map((icon) => icon.image)).size, 5)
  for (const icon of LOCATION_TYPE_ICONS) {
    const png = await readFile(new URL(`../public${icon.image}`, import.meta.url))
    assert.equal(png.subarray(1, 4).toString(), "PNG")
    assert.equal(png.readUInt32BE(16), 512)
    assert.equal(png.readUInt32BE(20), 512)
    assert.equal(png[25], 6)
  }
})
