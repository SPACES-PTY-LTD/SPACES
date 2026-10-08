export type ProcessingImport = { status: string; failure_message?: string | null };

/** Bound each foreground check; callers retain the import ID for Check again. */
export async function pollDocumentImport<T extends ProcessingImport>(
  fetchStatus: (signal: AbortSignal) => Promise<T>, signal: AbortSignal,
  onReceived: () => void,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  }),
): Promise<T> {
  const deadline = Date.now() + 120000;
  for (let attempt = 0; attempt < 38; attempt++) {
    if (signal.aborted) throw new Error('Processing check cancelled.');
    if (Date.now() >= deadline) break;
    const request = new AbortController();
    const cancelRequest = () => request.abort();
    signal.addEventListener('abort', cancelRequest, { once: true });
    const timeout = setTimeout(cancelRequest, 10000);
    try {
      const result = await fetchStatus(request.signal);
      if (signal.aborted) throw new Error('Processing check cancelled.');
      onReceived();
      if (['analyzed', 'confirmed', 'failed'].includes(result.status)) return result;
      if (!['queued', 'processing'].includes(result.status)) throw new Error('Unexpected document processing status. Please check again.');
    } catch (error) {
      const status = (error as { status?: number }).status;
      // Brief 404s can occur when upload acknowledgement was lost before creation committed.
      if (signal.aborted || (status && status < 500 && ![404, 408, 429].includes(status))) throw error;
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancelRequest);
    }
    if (attempt < 37) await wait(3200);
  }
  throw new Error('Your document may still be processing. Tap Check processing status to continue without uploading again.');
}
