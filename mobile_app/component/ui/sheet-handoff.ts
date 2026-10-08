/** Serialize a sheet -> chooser/native UI -> sheet round trip without timers.
 * The owner forwards its completed (post-portal-removal) onDismiss event.
 * Draft state stays owned by the mounted screen throughout the round trip.
 */
export function createSheetHandoff(dismiss: () => void, restore: () => void) {
  let active = true;
  let running = false;
  let pending: ((dismissed: boolean) => void) | undefined;
  return {
    get active() { return active; },
    get running() { return running; },
    async run(task: () => Promise<void>) {
      if (!active || running) return;
      running = true;
      try {
        const dismissed = await new Promise<boolean>(resolve => {
          pending = resolve;
          dismiss();
        });
        if (dismissed && active) await task();
      } finally {
        pending = undefined;
        if (active) restore();
        running = false;
      }
    },
    onDismiss() {
      if (!pending) return running;
      const resolve = pending;
      pending = undefined;
      resolve(true);
      return true;
    },
    dispose() {
      active = false;
      pending?.(false);
      pending = undefined;
    },
  };
}
