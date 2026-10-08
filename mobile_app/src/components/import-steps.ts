export type ImportStep = 1 | 2 | 3 | 4 | 5;
export const importStepLabels = ['Choose file', 'Reading file', 'Trip locations', 'Shipments found', 'Choose run'] as const;

/** Earlier steps only; network work must finish before changing the active screen. */
export function canReturnToImportStep(current: ImportStep, target: ImportStep, locked = false) {
  return !locked && target < current;
}
