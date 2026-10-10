type Location = { lat: number; lng: number };
type Listen = (callback: ((location: Location) => void) | null) => void;

/** Starting SDK tracking is asynchronous; routing needs its first usable fix. */
export function waitForSdkLocation(listen: Listen, start: () => void, isCurrent: () => boolean, timeoutMs = 20_000): Promise<void> {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout); clearInterval(cancellation);
      listen(null);
      if (error) reject(error); else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('Unable to get a navigation location. Try again.')), timeoutMs);
    const cancellation = setInterval(() => { if (!isCurrent()) finish(new Error('Navigation cancelled.')); }, 100);
    listen(location => {
      if (!isCurrent()) return finish(new Error('Navigation cancelled.'));
      if (Number.isFinite(location.lat) && Math.abs(location.lat) <= 90 && Number.isFinite(location.lng) && Math.abs(location.lng) <= 180) finish();
    });
    try { start(); } catch (error) { finish(error instanceof Error ? error : new Error('Unable to start navigation location.')); }
  });
}
