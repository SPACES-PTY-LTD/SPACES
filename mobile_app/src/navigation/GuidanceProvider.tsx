import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useAuth } from '@/src/providers/auth-provider';
import { driverApi } from '@/src/lib/api';
import { currentNavigationLocation } from '@/src/components/dashboard/navigation-location';
import { createGuidanceSession, type GuidanceState, type GuidanceTarget } from './guidance-session';
import { navigationSdk } from './navigation-sdk';

type GuidanceContextValue = { state: GuidanceState; available: boolean; start: (target: GuidanceTarget) => Promise<void>; exit: () => Promise<void>; mute: () => Promise<void> };
const idle: GuidanceState = { phase: 'idle', muted: false };
const Context = createContext<GuidanceContextValue>({ state: idle, available: false, start: async () => {}, exit: async () => {}, mute: async () => {} });
export const useGuidance = () => useContext(Context);

export function GuidanceProvider({ children }: { children: ReactNode }) {
  const sdk = navigationSdk;
  if (!sdk) return <Context.Provider value={{ state: idle, available: false, start: async () => {}, exit: async () => {}, mute: async () => {} }}>{children}</Context.Provider>;
  return <sdk.NavigationProvider termsAndConditionsDialogOptions={{ title: 'Navigation terms', companyName: 'Spaces Digital', showOnlyDisclaimer: false }}
    taskRemovedBehavior={sdk.TaskRemovedBehavior.QUIT_SERVICE}><NativeGuidance>{children}</NativeGuidance></sdk.NavigationProvider>;
}

function nativeAdapter(controller: ReturnType<NonNullable<typeof navigationSdk>['useNavigation']>['navigationController'], sdk: NonNullable<typeof navigationSdk>): import('./guidance-session').GuidanceAdapter {
  let nativeInitialized = false;
  return {
    prepare: async isCurrent => {
      await currentNavigationLocation(isCurrent);
      if (!isCurrent()) return false;
      if (!await controller.areTermsAccepted() && !await controller.showTermsAndConditionsDialog()) return false;
      if (!isCurrent()) return false;
      const permission = await Location.requestBackgroundPermissionsAsync();
      if (!isCurrent()) return false;
      if (permission.status !== 'granted') throw new Error('Allow background location to keep navigation running when Spaces is closed.');
      const alerts = await Notifications.requestPermissionsAsync();
      if (!isCurrent()) return false;
      if (!alerts.granted) throw new Error('Allow notifications for navigation guidance while Spaces is in the background.');
      return true;
    },
    initialize: async () => { nativeInitialized = true; return controller.init(); },
    destination: target => controller.setDestination({ title: target.title, position: { lat: target.latitude, lng: target.longitude } }, { routingOptions: { travelMode: sdk.TravelMode.DRIVING } }),
    start: async () => {
      if (Platform.OS === 'ios') controller.setBackgroundLocationUpdatesEnabled(true);
      await controller.startUpdatingLocation();
      await controller.startGuidance();
    },
    stop: async () => {
      if (!nativeInitialized) return;
      await controller.stopGuidance();
      await controller.clearDestinations();
      if (Platform.OS === 'ios') controller.setBackgroundLocationUpdatesEnabled(false);
      controller.stopUpdatingLocation();
      await controller.cleanup();
      nativeInitialized = false;
    },
    audio: async muted => { await controller.setAudioGuidanceType(muted ? sdk.AudioGuidance.SILENT : sdk.AudioGuidance.VOICE_ALERTS_AND_GUIDANCE | sdk.AudioGuidance.BLUETOOTH_AUDIO); },
  };
}

function NativeGuidance({ children }: { children: ReactNode }) {
  const sdk = navigationSdk!;
  const { navigationController: controller, setOnArrival, setOnRemainingTimeOrDistanceChanged, setOnReroutingRequestedByOffRoute, setOnRouteChanged } = sdk.useNavigation();
  const { session } = useAuth();
  const owner = session?.token;
  const currentOwner = useRef(owner);
  useEffect(() => { currentOwner.current = owner; }, [owner]);
  const engine = useMemo(() => createGuidanceSession(nativeAdapter(controller, sdk)), [controller, sdk]);
  const state = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
  useEffect(() => {
    setOnArrival(() => { void engine.arrived(); });
    setOnRemainingTimeOrDistanceChanged(value => engine.progress(value.seconds, value.meters));
    setOnReroutingRequestedByOffRoute(() => engine.rerouting());
    setOnRouteChanged(() => { void controller.getCurrentTimeAndDistance().then(value => engine.progress(value.seconds, value.meters)).catch(() => {}); });
    return () => {
      setOnArrival(null); setOnRemainingTimeOrDistanceChanged(null); setOnReroutingRequestedByOffRoute(null); setOnRouteChanged(null);
      void engine.stop();
    };
  }, [engine, controller, setOnArrival, setOnRemainingTimeOrDistanceChanged, setOnReroutingRequestedByOffRoute, setOnRouteChanged]);
  useEffect(() => { if (state.target && state.target.owner !== owner) void engine.stop(); }, [engine, owner, state.target]);
  useEffect(() => {
    if (state.phase !== 'stopping' || !state.error) return;
    // Retry cleanup even when logout or removed work hides the dashboard Exit control.
    const timer = setTimeout(() => void engine.stop(), 5_000);
    return () => clearTimeout(timer);
  }, [engine, state.phase, state.error]);
  useEffect(() => {
    if (state.phase !== 'guiding' || !state.target) return;
    let cancelled = false, pending = false;
    const target = state.target;
    const validate = async () => {
      if (pending || cancelled || AppState.currentState !== 'active' || currentOwner.current !== target.owner) return;
      pending = true;
      try {
        const dashboard = await driverApi.dashboard(target.owner);
        if (!cancelled && (dashboard.current_run?.run_id !== target.runId || dashboard.current_run.status !== 'in_progress'
          || !dashboard.run_shipments.some(s => s.shipment_id === target.shipmentId && !['delivered', 'failed', 'cancelled', 'returned'].includes(s.status)))) void engine.stop();
      } catch { /* Transient API failure must not interrupt native road guidance. */ }
      finally { pending = false; }
    };
    void validate();
    const timer = setInterval(() => void validate(), 60_000);
    const listener = AppState.addEventListener('change', appState => { if (appState === 'active') void validate(); });
    return () => { cancelled = true; clearInterval(timer); listener.remove(); };
  }, [engine, state.phase, state.target]);
  useEffect(() => {
    const awake = () => {
      if (state.phase === 'guiding' && AppState.currentState === 'active') void activateKeepAwakeAsync('delivery-guidance').catch(() => {});
      else void deactivateKeepAwake('delivery-guidance');
    };
    awake(); const listener = AppState.addEventListener('change', awake);
    return () => { listener.remove(); void deactivateKeepAwake('delivery-guidance'); };
  }, [state.phase]);
  const value = useMemo(() => ({ state, available: true, start: (target: GuidanceTarget) => currentOwner.current === target.owner ? engine.start(target) : Promise.resolve(), exit: engine.stop, mute: engine.mute }), [engine, state]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
