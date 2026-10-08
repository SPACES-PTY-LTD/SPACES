const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
const message = (value: unknown) => typeof value === 'string' ? value.trim() : '';

/** Read public error fields from API envelopes and Laravel validation responses. */
export function documentImportErrorMessage(payload: unknown, status: number) {
  const body = record(payload);
  const error = record(body?.error);
  const summary = message(error?.message) || message(body?.message) || message(body?.error) || message(payload);
  const details = [error?.details, body?.errors, body?.details].flatMap(value => {
    const fields = record(value);
    const values = fields ? Object.values(fields) : Array.isArray(value) ? value : [value];
    return values.flatMap(field => (Array.isArray(field) ? field : [field]).map(message)).filter(Boolean);
  });
  const messages = [...new Set([summary, ...details].filter(Boolean))];
  return messages.length ? messages.join('\n') : `Unable to read the delivery note (HTTP ${status}). Please try again.`;
}
