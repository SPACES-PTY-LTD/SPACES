import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../src/components/runs/run-geofence-data.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { loadGeofenceLocations } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("deduplicates locations and reuses successful loads on subsequent toggles", async () => {
  const cache = new Map(), requests = []
  const fetch = async id => { requests.push(id); return { location_id: id } }
  await loadGeofenceLocations(["a", "a", "b"], cache, fetch, () => false)
  const result = await loadGeofenceLocations(["a", "b"], cache, fetch, () => false)
  assert.deepEqual(requests, ["a", "b"])
  assert.equal(result.locations.length, 2)
})

test("partial failure retains successes and retries only missing locations", async () => {
  const cache = new Map()
  const result = await loadGeofenceLocations(["a", "b"], cache, async id => {
    if (id === "b") throw Error("unavailable")
    return { location_id: id }
  }, () => false)
  assert.equal(result.failed, true)
  assert.equal(result.locations.length, 1)
  const requests = []
  const retry = await loadGeofenceLocations(["a", "b"], cache, async id => { requests.push(id); return { location_id: id } }, () => false)
  assert.equal(retry.failed, false)
  assert.deepEqual(requests, ["b"])
})

test("turning off stops queued requests and discards late results", async () => {
  const cache = new Map(), releases = [], requests = []
  let cancelled = false
  const pending = loadGeofenceLocations(["a", "b", "c", "d", "e"], cache, id => {
    requests.push(id)
    return new Promise(resolve => releases.push(() => resolve({ location_id: id })))
  }, () => cancelled)
  assert.equal(requests.length, 4)
  cancelled = true
  releases.forEach(release => release())
  await pending
  assert.equal(cache.size, 0)
  assert.equal(requests.length, 4)
})
