import test from 'node:test';
import assert from 'node:assert/strict';
import { canReturnToImportStep } from '../src/components/import-steps.ts';

test('each completed step is reachable, while current and future steps are blocked', () => {
  for (let current = 1; current <= 5; current++) {
    for (let target = 1; target <= 5; target++) {
      assert.equal(canReturnToImportStep(current, target), target < current);
    }
  }
});
test('upload, preview and confirmation locks block every backward transition', () => {
  for (let current = 2; current <= 5; current++) {
    for (let target = 1; target < current; target++) {
      assert.equal(canReturnToImportStep(current, target, true), false);
      assert.equal(canReturnToImportStep(current, target, false), true);
    }
  }
});
