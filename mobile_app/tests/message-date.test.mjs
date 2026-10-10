import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

process.env.TZ = 'Africa/Johannesburg';
const helpers = {};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/message-date.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: helpers, Date, Number });
const { messageDayLabel } = helpers;

test('first loaded message gets a localized date heading', () => {
    assert.equal(messageDayLabel('2026-10-09T12:00:00Z'), new Date('2026-10-09T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }));
});
test('local midnight splits messages even within the same UTC day', () => {
    assert.ok(messageDayLabel('2026-10-09T22:01:00Z', '2026-10-09T21:59:00Z'));
});
test('same local day joins different UTC days and timestamp offsets', () => {
    assert.equal(messageDayLabel('2026-10-10T00:01:00Z', '2026-10-09T22:01:00Z'), null);
    assert.equal(messageDayLabel('2026-10-10T02:01:00+02:00', '2026-10-10T00:01:00Z'), null);
});
test('year transitions split and malformed timestamps never invent a date', () => {
    assert.ok(messageDayLabel('2027-01-01T00:01:00+02:00', '2026-12-31T23:59:00+02:00'));
    assert.equal(messageDayLabel('invalid'), null);
    assert.ok(messageDayLabel('2026-10-09T12:00:00Z', 'invalid'));
});
