export type GuidanceTarget = { owner: string; runId: string; shipmentId: string; title: string; latitude: number; longitude: number };
export type GuidanceState = { phase: 'idle' | 'starting' | 'guiding' | 'arrived' | 'stopping'; target?: GuidanceTarget; error?: string; muted: boolean; seconds?: number; arrivalAt?: number; meters?: number; rerouting?: boolean };
export type GuidanceAdapter = {
  prepare: (isCurrent: () => boolean) => Promise<boolean>;
  initialize: () => Promise<string>;
  destination: (target: GuidanceTarget) => Promise<string>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  audio: (muted: boolean) => Promise<void>;
};

/** Serializes the single native navigator, including cancellation during async setup. */
export function createGuidanceSession(adapter: GuidanceAdapter) {
  let state: GuidanceState = { phase: 'idle', muted: false }, revision = 0;
  let queue = Promise.resolve();
  const listeners = new Set<() => void>();
  const publish = (next: GuidanceState) => { state = next; listeners.forEach(fn => fn()); };
  const enqueue = (work: () => Promise<void>) => { queue = queue.then(work, work); return queue; };
  const stop = () => {
    ++revision;
    publish({ ...state, phase: 'stopping', error: undefined });
    return enqueue(async () => {
      try { await adapter.stop(); publish({ phase: 'idle', muted: false }); }
      catch { publish({ ...state, phase: 'stopping', error: 'Unable to stop navigation. Tap Exit to retry.' }); }
    });
  };
  return {
    snapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    start(target: GuidanceTarget) {
      if (state.phase !== 'idle') return queue;
      if (!Number.isFinite(target.latitude) || Math.abs(target.latitude) > 90 || !Number.isFinite(target.longitude) || Math.abs(target.longitude) > 180) {
        publish({ phase: 'idle', muted: false, error: 'Delivery coordinates are unavailable.' }); return queue;
      }
      const version = ++revision, isCurrent = () => version === revision;
      publish({ phase: 'starting', target, muted: false });
      return enqueue(async () => {
        let initialized = false;
        try {
          if (!await adapter.prepare(isCurrent) || !isCurrent()) { if (isCurrent()) publish({ phase: 'idle', muted: false }); return; }
          initialized = true;
          const init = await adapter.initialize();
          if (!isCurrent()) return;
          if (init !== 'ok') throw new Error(`Navigation unavailable (${init}). Check location access and try again.`);
          const status = await adapter.destination(target);
          if (!isCurrent()) return;
          if (status !== 'OK') throw new Error(`Unable to start this route (${status}). Try again.`);
          await adapter.audio(false);
          if (!isCurrent()) return;
          await adapter.start();
          if (isCurrent()) publish({ phase: 'guiding', target, muted: false });
        } catch (failure) {
          if (initialized) {
            try { await adapter.stop(); } catch { if (isCurrent()) { publish({ phase: 'stopping', target, muted: false, error: 'Unable to stop navigation. Tap Exit to retry.' }); return; } }
          }
          if (isCurrent()) publish({ phase: 'idle', muted: false, error: failure instanceof Error ? failure.message : 'Navigation unavailable. Try again.' });
        }
      });
    },
    stop,
    mute() {
      if (state.phase !== 'guiding') return queue;
      const muted = !state.muted, version = revision;
      return enqueue(async () => {
        if (version !== revision) return;
        try { await adapter.audio(muted); if (version === revision) publish({ ...state, muted }); }
        catch { if (version === revision) publish({ ...state, error: 'Unable to change voice guidance. Try again.' }); }
      });
    },
    progress(seconds: number, meters: number) {
      if (state.phase !== 'guiding' || !Number.isFinite(seconds) || seconds < 0 || !Number.isFinite(meters) || meters < 0) return;
      publish({ ...state, seconds, meters, arrivalAt: Date.now() + seconds * 1000, rerouting: false });
    },
    rerouting() { if (state.phase === 'guiding') publish({ ...state, rerouting: true }); },
    arrived() {
      if (state.phase !== 'guiding') return;
      const version = revision;
      publish({ ...state, phase: 'arrived', seconds: 0, meters: 0 });
      return enqueue(async () => {
        try { await adapter.stop(); } catch { if (version === revision) publish({ ...state, phase: 'stopping', error: 'Unable to stop navigation. Tap Exit to retry.' }); }
      });
    },
  };
}
