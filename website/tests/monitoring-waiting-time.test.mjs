import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const source = await readFile(new URL("../src/app/admin/logistics/shipments/monitoring/waiting-time.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { getTruckWaitingState, formatWaitingMinutes } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
const now = 10_000_000;
const truck = { status: "parked", locationId: "depot", changedAt: now, waitingSinceMs: now - 40 * 60_000, maxWaitingMs: 30 * 60_000 };
test("uses arrival time and survives refresh; trucks at the same stop have independent waits", () => {
  assert.equal(getTruckWaitingState(truck, now).overdueByMs, 10 * 60_000);
  assert.equal(getTruckWaitingState({ ...truck, changedAt: now + 1_000 }, now + 1_000).overdueByMs, 10 * 60_000 + 1_000);
  assert.equal(getTruckWaitingState({ ...truck, waitingSinceMs: now - 5 * 60_000 }, now).isWaitingOverdue, false);
});
test("strict threshold and zero limits are supported", () => {
  assert.equal(getTruckWaitingState({ ...truck, maxWaitingMs: 40 * 60_000 }, now).isWaitingOverdue, false);
  assert.equal(getTruckWaitingState({ ...truck, maxWaitingMs: 40 * 60_000 }, now + 1).isWaitingOverdue, true);
  assert.equal(getTruckWaitingState({ ...truck, maxWaitingMs: 0 }, now).isWaitingOverdue, true);
});
test("missing or invalid arrivals and limits never create overdue alerts", () => {
  for (const waitingSinceMs of [null, NaN, now + 1]) assert.equal(getTruckWaitingState({ ...truck, waitingSinceMs }, now).isWaitingOverdue, false);
  for (const maxWaitingMs of [undefined, NaN, -1]) assert.equal(getTruckWaitingState({ ...truck, maxWaitingMs }, now).isWaitingOverdue, false);
});
test("exit, arrival animations and unknown parking are excluded; open standby visits remain eligible", () => {
  for (const status of ["departing", "arriving"]) assert.equal(getTruckWaitingState({ ...truck, status }, now).isWaitingOverdue, false);
  for (const locationId of ["ON_ROAD", "PARKING_UNKNOWN"]) assert.equal(getTruckWaitingState({ ...truck, locationId }, now).isWaitingOverdue, false);
  assert.equal(getTruckWaitingState({ ...truck, locationId: "PARKING_STANDBY" }, now).isWaitingOverdue, true);
});
test("messages show minute counts including a sub-minute overrun", () => {
  assert.equal(formatWaitingMinutes(1_000), "less than 1 minute");
  assert.equal(formatWaitingMinutes(60_000), "1 minute");
  assert.equal(formatWaitingMinutes(90 * 60_000), "90 minutes");
  assert.equal(formatWaitingMinutes(0), "0 minutes");
});
