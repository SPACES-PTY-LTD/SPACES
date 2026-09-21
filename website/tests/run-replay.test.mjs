import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"
const source = await readFile(new URL("../src/components/runs/run-replay.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { buildReplayModel, replayAt, loadTrackPages, mergeTrackPages } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const at = minutes => new Date(Date.UTC(2026, 8, 21, 8, minutes)).toISOString()
const ms = minutes => Date.parse(at(0)) + minutes * 60000
const point = (minutes, latitude = -26) => ({ latitude, longitude: 28, observed_at: at(minutes) })
const page = (segments, next = null) => ({ status: "ready", source: "recorded_gps", active: false, stops: [], segments, updated_at: at(10), latest_observed_at: at(10), coverage: { partial: false, next_before: next, displayed_coordinates: segments.flat().length } })

test("interpolates within observed segments and never across GPS gaps", () => {
  const model = buildReplayModel(page([[point(0, -26), point(4, -25)], [point(15), point(19)]]), [])
  assert.equal(replayAt(model, ms(2)).position.lat, -25.5)
  assert.equal(replayAt(model, ms(10)).position, null)
  assert.equal(replayAt(model, ms(10)).title, "No GPS data")
  assert.deepEqual(model.gaps, [{ start: ms(4), end: ms(15) }])
})

test("holds the vehicle at a stop and prioritizes delivery context over GPS stationary", () => {
  const track = page([[point(0), point(30)]])
  track.stops = [{ latitude: -26, longitude: 28, first_seen_at: at(0), last_seen_at: at(30), sample_count: 30 }]
  const model = buildReplayModel(track, [{ event_type: "shipment_delivery", entered_at: at(5), exited_at: at(23), latitude: -25.9, longitude: 28.1, location: { name: "Customer" } }])
  assert.equal(replayAt(model, ms(12)).position.lat, -25.9)
  assert.equal(replayAt(model, ms(12)).title, "Delivery · Customer")
  assert.equal(replayAt(model, ms(12)).detail, "Stopped 18 min")
  assert.equal(model.gaps.length, 0)
})

test("invalid points, reversed timestamps and long sampling intervals break interpolation", () => {
  for (const samples of [[point(0), { ...point(2), latitude: null }, point(4)], [point(0), point(10)], [point(4), point(0)]]) {
    const model = buildReplayModel(page([samples]), [])
    assert.equal(replayAt(model, ms(2)).position, null)
  }
})

test("missing locations retain stop context without fabricating a car position", () => {
  const model = buildReplayModel(null, [{ entered_at: at(0), exited_at: at(10), event_type: "entered_location", location: { name: "Depot" } }])
  assert.equal(replayAt(model, ms(5)).position, null)
  assert.match(replayAt(model, ms(5)).detail, /Position unavailable/)
  assert.equal(buildReplayModel(null, [{ occurred_at: "bad" }]), null)
})

test("unknown departure stays a point event, not an open interval to the present", () => {
  const model = buildReplayModel(page([[point(0)], [point(30)]]), [{ event_type: "stopped", occurred_at: at(0), latitude: -26, longitude: 28 }])
  assert.equal(model.events[0].start, model.events[0].end)
  assert.equal(replayAt(model, ms(20)).position, null)
})

test("loads all cursor pages and keeps their boundaries", async () => {
  const calls = []
  const result = await loadTrackPages(async cursor => { calls.push(cursor); return cursor ? page([[point(0), point(4)]]) : page([[point(5), point(9)]], "older") })
  assert.deepEqual(calls, [undefined, "older"])
  assert.equal(result.error, null)
  assert.equal(result.track.segments.length, 2)
  assert.equal(result.track.coverage.next_before, null)
  assert.equal(replayAt(buildReplayModel(result.track, []), ms(4.5)).position, null)
})

test("pagination failure retains loaded data, cyclic cursors stop, cancellation avoids further requests", async () => {
  const failed = await loadTrackPages(async cursor => { if (cursor) throw Error("Offline"); return page([[point(5)]], "older") })
  assert.equal(failed.error, "Offline")
  assert.equal(failed.track.segments.length, 1)
  let calls = 0
  const cycle = await loadTrackPages(async () => { calls++; return page([[point(5)]], "same") })
  assert.equal(calls, 2)
  assert.match(cycle.error, /did not advance/)
  const cancelled = await loadTrackPages(async () => { throw Error("Should not fetch") }, () => false)
  assert.equal(cancelled.interrupted, true)
  assert.equal(mergeTrackPages([]), null)
})
