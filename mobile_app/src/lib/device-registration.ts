/** Share attempts across foreground, settings and native token callbacks. */
export function createDeviceRegistrationGate(now = Date.now) {
  const sessions = new Map<string, {
    pending?: Promise<void>; nextAttempt: number; failures: number;
    registered?: string; registeredAt?: number;
  }>();
  return function register(token: string, isCurrent: () => boolean, getPushToken: () => Promise<string | null>, submit: (pushToken: string) => Promise<unknown>): Promise<void> {
    let state = sessions.get(token);
    if (!state) {
      state = { nextAttempt: 0, failures: 0 };
      // Bound retained sessions without retaining credentials across app launches.
      if (sessions.size >= 5) sessions.delete(sessions.keys().next().value!);
      sessions.set(token, state);
    }
    if (state.pending) return state.pending;
    if (!isCurrent() || now() < state.nextAttempt) return Promise.resolve();
    const current = state;
    current.nextAttempt = now() + 60_000;
    // Defer work until pending is assigned: token retrieval can emit a callback.
    current.pending = Promise.resolve().then(async () => {
      try {
        const push = await getPushToken();
        if (!push || !isCurrent()) return;
        if (current.registered === push && now() - (current.registeredAt ?? 0) < 24 * 60 * 60_000) return;
        await submit(push);
        if (!isCurrent()) return;
        current.registered = push;
        current.registeredAt = now();
        current.failures = 0;
      } catch (error) {
        current.failures++;
        const retryAfterMs = (error as { retryAfterMs?: number }).retryAfterMs ?? 0;
        const backoff = Math.min(15 * 60_000, 60_000 * 2 ** Math.min(current.failures - 1, 4));
        current.nextAttempt = now() + Math.max(backoff, retryAfterMs);
        throw error;
      } finally {
        current.pending = undefined;
      }
    });
    return current.pending;
  };
}
