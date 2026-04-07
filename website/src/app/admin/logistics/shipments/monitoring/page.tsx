"use client";

import Link from "next/link";
import { Canvas } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { isApiErrorResponse } from "@/lib/api/client";
import { listAllVehiclesCheck, listVehicleActivities } from "@/lib/api/vehicle-activities";
import { ShipmentMapDialog } from "@/components/dashboard/shipment-map-dialog";
import { DriverMapDialog } from "@/components/dashboard/driver-map-dialog";
import { LocationMapDialog } from "@/components/dashboard/location-map-dialog";
import { AdminLinks, AdminRoute, withAdminQuery } from "@/lib/routes/admin";
import type { VehicleActivity } from "@/lib/types";
import {
  ACTIVITY_API_POLL_INTERVAL_MS,
  ACTIVITY_FEED_SOURCE,
  BASE_ROAD_LANE_COUNT,
  LOCATION_EXIT_MS,
  ROAD_COLUMNS_PER_ROW
} from "./constants";
import { ActivityScene } from "./components/activity-scene";
import type { SceneCameraApi } from "./components/activity-scene";
import { ActivitySummary } from "./components/activity-summary";
import { FilterLocationsDialog } from "./components/filter-locations-dialog";
import { ViewPresetControls } from "./components/view-preset-controls";
import {
  createLoadForTruck,
  createInitialUnknownParkingTrucks,
  createPlaceholderNode,
  createPlateNumber,
  startTruckStream,
  syncLocationsFromTrucks
} from "./simulation";
import type { FilterableLocationMeshType, LocationNode, TruckEvent, TruckRender } from "./types";

const ROAD_ARRIVE_TRAVEL_MIN_MS = 10600;
const ROAD_ARRIVE_TRAVEL_MAX_MS = 90000;
const ROAD_DEPART_TRAVEL_MS = 10600;
const ROAD_EXIT_ANIMATION_MS = 900;
const BASE_ROAD_SLOT_COUNT = BASE_ROAD_LANE_COUNT * ROAD_COLUMNS_PER_ROW;

function createRoadPlaceholders(count: number): Array<TruckRender | null> {
  return Array.from({ length: count }, () => null);
}

function normalizeRoadSlots(slots: Array<TruckRender | null>): Array<TruckRender | null> {
  let next = [...slots];
  if (next.length < BASE_ROAD_SLOT_COUNT) {
    next = [...next, ...createRoadPlaceholders(BASE_ROAD_SLOT_COUNT - next.length)];
  }

  while (next.length > BASE_ROAD_SLOT_COUNT) {
    const laneStart = next.length - ROAD_COLUMNS_PER_ROW;
    const lane = next.slice(laneStart);
    const laneIsOnlyPlaceholders = lane.every((slot) => slot === null);
    if (!laneIsOnlyPlaceholders) break;
    next = next.slice(0, laneStart);
  }

  return next;
}

function assignTruckToEarliestRoadPlaceholder(
  slots: Array<TruckRender | null>,
  truck: TruckRender
): Array<TruckRender | null> {
  let next = normalizeRoadSlots(slots);
  next = next.map((slot) => (slot?.truckId === truck.truckId ? null : slot));
  let placeholderIndex = next.findIndex((slot) => slot === null);

  if (placeholderIndex === -1) {
    const oldLength = next.length;
    next = [...next, ...createRoadPlaceholders(ROAD_COLUMNS_PER_ROW)];
    placeholderIndex = oldLength;
  }

  next[placeholderIndex] = truck;
  return next;
}

function replaceRoadTruckWithPlaceholder(
  slots: Array<TruckRender | null>,
  truckId: string
): Array<TruckRender | null> {
  const next = slots.map((slot) => (slot?.truckId === truckId ? null : slot));
  return normalizeRoadSlots(next);
}

function updateRoadTruckStatus(
  slots: Array<TruckRender | null>,
  truckId: string,
  status: TruckRender["status"]
): Array<TruckRender | null> {
  return slots.map((slot) => {
    if (!slot || slot.truckId !== truckId) return slot;
    return {
      ...slot,
      status,
      changedAt: Date.now()
    };
  });
}

function formatEventType(value?: string): string {
  if (!value) return "Unknown";
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function isExitedLocationEvent(eventType?: string): boolean {
  return (eventType ?? "").toLowerCase() === "exited_location";
}

function classifyActivityPlacement(activity: VehicleActivity): "location" | "road" | "unknown" {
  if (Boolean(activity.location?.location_id) && !isExitedLocationEvent(activity.event_type)) {
    return "location";
  }

  const hasRoadSignal = Boolean(
    activity.event_type ??
      activity.location?.location_id ??
      activity.latitude ??
      activity.longitude ??
      activity.speed_kph ??
      activity.speed_limit_kph ??
      activity.occurred_at ??
      activity.created_at
  );

  return hasRoadSignal ? "road" : "unknown";
}

function isTruckSpeeding(truck: Pick<TruckRender, "speedKph" | "speedLimitKph">): boolean {
  return (
    truck.speedKph !== null &&
    truck.speedKph !== undefined &&
    truck.speedLimitKph !== null &&
    truck.speedLimitKph !== undefined &&
    truck.speedKph > truck.speedLimitKph
  );
}

function formatDurationMs(value: number): string {
  const totalSeconds = Math.max(0, Math.floor(value / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m ${seconds}s`;
}

function getMetadataString(metadata: Record<string, unknown> | null | undefined, key: string): string | null {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getDriverInfo(activity: VehicleActivity): {
  driver: string;
  driverId: string | null;
  driverEmail: string | null;
  driverTelephone: string | null;
  driverIntegrationId: string | null;
} {
  const metadataIntegrationId =
    getMetadataString(activity.metadata, "driver_intergration_id") ??
    getMetadataString(activity.metadata, "driver_integration_id");
  const driverName = activity.driver?.name?.trim() || null;

  return {
    driver: driverName ?? activity.driver?.intergration_id ?? metadataIntegrationId ?? "Unknown driver",
    driverId: activity.driver?.driver_id ?? null,
    driverEmail: activity.driver?.email ?? null,
    driverTelephone: activity.driver?.telephone ?? null,
    driverIntegrationId: activity.driver?.intergration_id ?? metadataIntegrationId ?? null
  };
}

function getVehicleKey(activity: VehicleActivity): string | null {
  return (
    activity.vehicle?.vehicle_id ??
    activity.vehicle_id ??
    activity.vehicle?.plate_number ??
    activity.vehicle?.ref_code ??
    null
  );
}

function getActivityTime(activity: VehicleActivity): number {
  const raw = activity.occurred_at ?? activity.created_at;
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveLocationMeshType(icon?: string | null): FilterableLocationMeshType {
  const normalized = icon?.trim().toLowerCase();
  if (normalized === "workshop") return "workshop";
  if (normalized === "waypoint") return "waypoint";
  if (normalized === "restarea") return "rest";
  if (normalized === "fuel") return "fuel";
  return "warehouse";
}

function buildLocationDetails(activity: VehicleActivity) {
  return {
    label: activity.location?.name ?? activity.location?.company ?? String(activity.location?.location_id),
    company: activity.location?.company ?? null,
    fullAddress: activity.location?.full_address ?? null,
    city: activity.location?.city ?? null,
    province: activity.location?.province ?? null,
    country: activity.location?.country ?? null,
    meshType: resolveLocationMeshType(activity.location?.type?.icon)
  };
}

function getLatestActivityPerVehicle(data: VehicleActivity[]): VehicleActivity[] {
  const byVehicle = new Map<string, VehicleActivity>();
  for (const activity of data) {
    const key = getVehicleKey(activity);
    if (!key) continue;
    const previous = byVehicle.get(key);
    if (!previous || getActivityTime(activity) > getActivityTime(previous)) {
      byVehicle.set(key, activity);
    }
  }
  return Array.from(byVehicle.values()).sort((a, b) => getActivityTime(b) - getActivityTime(a));
}

function buildTruckFromActivity(activity: VehicleActivity, changedAt: number): TruckRender {
  const truckId = getVehicleKey(activity) ?? activity.activity_id ?? `ACT-${changedAt}`;
  const plateNumber = activity.vehicle?.plate_number ?? createPlateNumber(truckId);
  const driverInfo = getDriverInfo(activity);
  const hasLocation = Boolean(activity.location?.location_id) && !isExitedLocationEvent(activity.event_type);
  const locationId = hasLocation ? String(activity.location?.location_id) : "ON_ROAD";
  const locationLabel = hasLocation
    ? (activity.location?.name ?? activity.location?.company ?? String(activity.location?.location_id))
    : "On road";
  const shipmentRecord = activity.shipment
    ? {
        shipmentId: activity.shipment.shipment_id,
        merchantOrderRef: activity.shipment.merchant_order_ref ?? null,
        status: activity.shipment.status ?? null,
        autoCreated: activity.shipment.auto_created
      }
    : null;

  return {
    truckId,
    vehicleId: activity.vehicle?.vehicle_id ?? activity.vehicle_id ?? null,
    plateNumber,
    locationId,
    locationLabel,
    slot: 0,
    status: "parked",
    changedAt,
    driver: driverInfo.driver,
    driverId: driverInfo.driverId,
    driverEmail: driverInfo.driverEmail,
    driverTelephone: driverInfo.driverTelephone,
    driverIntegrationId: driverInfo.driverIntegrationId,
    shipment: {
      reference:
        activity.shipment?.merchant_order_ref ??
        activity.shipment?.shipment_id ??
        (activity.activity_id ? `ACT-${activity.activity_id.slice(0, 8)}` : `VEH-${truckId.slice(0, 8)}`),
      description: `${formatEventType(activity.event_type)} (${activity.vehicle?.make ?? "Vehicle"} ${activity.vehicle?.model ?? ""})`.trim(),
      destination: hasLocation ? (activity.location?.name ?? activity.location?.company ?? "On road") : "On road",
      weightKg: 0,
      pallets: 0,
      temperatureControlled: false
    },
    eventType: activity.event_type,
    speedKph: activity.speed_kph ?? null,
    speedLimitKph: activity.speed_limit_kph ?? null,
    latitude: activity.latitude ?? null,
    longitude: activity.longitude ?? null,
    occurredAt: activity.occurred_at ?? activity.created_at ?? null,
    vehicleRefCode: activity.vehicle?.ref_code ?? null,
    vehicleLabel: activity.vehicle?.ref_code ?? activity.vehicle?.plate_number ?? truckId,
    shipmentRecord
  };
}

function buildEventFromActivity(activity: VehicleActivity): TruckEvent {
  const truckId = getVehicleKey(activity) ?? activity.activity_id ?? `ACT-${Date.now()}`;
  const driverInfo = getDriverInfo(activity);
  const hasLocation = Boolean(activity.location?.location_id) && !isExitedLocationEvent(activity.event_type);
  const locationId = hasLocation ? String(activity.location?.location_id) : "ON_ROAD";
  return {
    truckId,
    locationId,
    driver: driverInfo.driver,
    driverId: driverInfo.driverId,
    driverEmail: driverInfo.driverEmail,
    driverTelephone: driverInfo.driverTelephone,
    driverIntegrationId: driverInfo.driverIntegrationId,
    action: hasLocation ? "ARRIVE" : "DEPART",
    timestamp: activity.occurred_at ?? activity.created_at ?? new Date().toISOString(),
    eventType: activity.event_type,
    activityId: activity.activity_id ?? undefined,
    locationLabel: hasLocation
      ? (activity.location?.name ?? activity.location?.company ?? String(activity.location?.location_id))
      : "On road",
    speedKph: activity.speed_kph ?? null,
    speedLimitKph: activity.speed_limit_kph ?? null
  };
}

export default function VirtualWarehousePage() {
  const { data: session } = useSession();
  const selectedMerchantId = session?.selected_merchant?.merchant_id ?? undefined;
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [locations, setLocations] = useState<LocationNode[]>([]);
  const [trucks, setTrucks] = useState<Record<string, TruckRender>>({});
  const [roadSlots, setRoadSlots] = useState<Array<TruckRender | null>>(() =>
    createRoadPlaceholders(BASE_ROAD_SLOT_COUNT)
  );
  const [parkingTrucks, setParkingTrucks] = useState<TruckRender[]>(() =>
    ACTIVITY_FEED_SOURCE === "dummy" ? createInitialUnknownParkingTrucks() : []
  );
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [visibleLocationTypes, setVisibleLocationTypes] = useState<FilterableLocationMeshType[]>([
    "warehouse",
    "workshop",
    "waypoint",
    "rest",
    "fuel"
  ]);
  const [showVehicleRegNumbers, setShowVehicleRegNumbers] = useState(false);
  const [showLocationLabels, setShowLocationLabels] = useState(false);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [selectedDriverDetailId, setSelectedDriverDetailId] = useState<string | null>(null);
  const [selectedLocationDetailId, setSelectedLocationDetailId] = useState<string | null>(null);
  const [latest, setLatest] = useState<TruckEvent | null>(null);
  const [history, setHistory] = useState<TruckEvent[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [timeTick, setTimeTick] = useState(() => Date.now());
  const roadTimersRef = useRef<number[]>([]);
  const sceneCameraApiRef = useRef<SceneCameraApi | null>(null);
  const hasInitializedDefaultViewRef = useRef(false);
  const randomRoadArriveTravelMs = () =>
    Math.floor(Math.random() * (ROAD_ARRIVE_TRAVEL_MAX_MS - ROAD_ARRIVE_TRAVEL_MIN_MS + 1)) +
    ROAD_ARRIVE_TRAVEL_MIN_MS;

  useEffect(() => {
    const timerId = window.setInterval(() => setTimeTick(Date.now()), 1000);
    return () => window.clearInterval(timerId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (ACTIVITY_FEED_SOURCE === "dummy") {
      const stop = startTruckStream((event) => {
        setLatest(event);
        setHistory((prev) => [event, ...prev].slice(0, 50));
        setApiError(null);

        if (event.action === "ARRIVE") {
          const roadTruck: TruckRender = {
            truckId: event.truckId,
            plateNumber: createPlateNumber(event.truckId),
            locationId: event.locationId,
            slot: 0,
            status: "arriving",
            changedAt: Date.now(),
            driver: event.driver,
            shipment: createLoadForTruck(event.truckId),
            eventType: event.eventType,
            speedKph: event.speedKph ?? null,
            speedLimitKph: event.speedLimitKph ?? null
          };

          setRoadSlots((prev) => assignTruckToEarliestRoadPlaceholder(prev, roadTruck));
          const arriveTimerId = window.setTimeout(() => {
            setRoadSlots((prev) => updateRoadTruckStatus(prev, event.truckId, "departing"));

            const roadExitTimerId = window.setTimeout(() => {
              setRoadSlots((prev) => replaceRoadTruckWithPlaceholder(prev, event.truckId));

              setTrucks((prev) => {
                const next = { ...prev };
                const usedSlots = new Set(
                  Object.values(next)
                    .filter((truck) => truck.locationId === event.locationId && truck.status !== "departing")
                    .map((truck) => truck.slot)
                );

                let slot = 0;
                while (usedSlots.has(slot)) slot += 1;

                const now = Date.now();
                const isLikelyOverdue = Math.random() < 0.55;
                const parkedChangedAt = isLikelyOverdue
                  ? now - (18 * 60_000 + Math.floor(Math.random() * 34 * 60_000))
                  : now - Math.floor(Math.random() * 6 * 60_000);

                next[event.truckId] = {
                  ...roadTruck,
                  status: "parked",
                  speedKph: 0,
                  slot,
                  changedAt: parkedChangedAt
                };

                setLocations((prevLocations) => syncLocationsFromTrucks(prevLocations, next));
                return next;
              });
            }, ROAD_EXIT_ANIMATION_MS);
            roadTimersRef.current.push(roadExitTimerId);
          }, randomRoadArriveTravelMs());

          roadTimersRef.current.push(arriveTimerId);
          return;
        }

        setTrucks((prev) => {
          const next = { ...prev };
          const current = next[event.truckId];
          if (!current) return next;

          next[event.truckId] = {
            ...current,
            status: "departing",
            changedAt: Date.now(),
            eventType: event.eventType ?? current.eventType,
            speedKph: event.speedKph ?? current.speedKph ?? null,
            speedLimitKph: event.speedLimitKph ?? current.speedLimitKph ?? null
          };

          setLocations((prevLocations) => syncLocationsFromTrucks(prevLocations, next));
          return next;
        });
      });

      return () => {
        stop();
      };
    }

    if (!session?.accessToken) return;

    let cancelled = false;
    const plateNumberFilter = debouncedSearchQuery || undefined;
    const run = async () => {
      const allVehiclesResponse = await listAllVehiclesCheck(session.accessToken, {
        page: 1,
        per_page: 500,
        merchant_id: selectedMerchantId,
        plate_number: plateNumberFilter
      });

      if (cancelled) return;
      if (isApiErrorResponse(allVehiclesResponse)) {
        setApiError(allVehiclesResponse.message);
        return;
      }
      const response = await listVehicleActivities(session.accessToken, {
        page: 1,
        per_page: 100,
        merchant_id: selectedMerchantId,
        plate_number: plateNumberFilter
      });

      if (cancelled) return;
      if (isApiErrorResponse(response)) {
        const now = Date.now();
        const fallbackParking: TruckRender[] = [];
        const fallbackLocationDetailsById = new Map<
          string,
          Pick<LocationNode, "label" | "company" | "fullAddress" | "city" | "province" | "country" | "meshType">
        >();
        const fallbackRoadSlots = (allVehiclesResponse.data ?? []).reduce<Array<TruckRender | null>>(
          (acc, item) => {
            const key = getVehicleKey(item);
            if (!key) return acc;

            const truck = buildTruckFromActivity(item, now);
            const placement = classifyActivityPlacement(item);
            if (placement === "unknown") {
              fallbackParking.push({
                ...truck,
                locationId: "PARKING_UNKNOWN",
                locationLabel: "Unknown location parking",
                slot: fallbackParking.length,
                status: "parked",
                changedAt: now
              });
              return acc;
            }

            if (placement === "road") {
              return assignTruckToEarliestRoadPlaceholder(acc, truck);
            }

            return acc;
          },
          createRoadPlaceholders(BASE_ROAD_SLOT_COUNT)
        );
        
        const fallbackTrucks = (allVehiclesResponse.data ?? []).reduce<Record<string, TruckRender>>((acc, item) => {
          const key = getVehicleKey(item);
          if (!key) return acc;

          if (classifyActivityPlacement(item) !== "location") {
            return acc;
          }

          const truck = buildTruckFromActivity(item, now);
          const resolvedLocationId = String(item.location?.location_id);
          fallbackLocationDetailsById.set(resolvedLocationId, buildLocationDetails(item));
          const usedSlots = new Set(
            Object.values(acc)
              .filter((existingTruck) => existingTruck.locationId === resolvedLocationId)
              .map((existingTruck) => existingTruck.slot)
          );
          let slot = 0;
          while (usedSlots.has(slot)) slot += 1;

          acc[truck.truckId] = {
            ...truck,
            locationId: resolvedLocationId,
            slot
          };
          return acc;
        }, {});

        setRoadSlots(fallbackRoadSlots);
        setTrucks(fallbackTrucks);
        setParkingTrucks(fallbackParking);
        setLocations((prevLocations) =>
          syncLocationsFromTrucks(prevLocations, fallbackTrucks).map((location) => {
            if (location.meshType === "placeholder") return location;
            const details = fallbackLocationDetailsById.get(location.locationId);
            if (!details) return location;
            return { ...location, ...details };
          })
        );
        setLatest(null);
        setHistory([]);
        setApiError(response.message);
        return;
      }

      const latestByVehicle = getLatestActivityPerVehicle(response.data ?? []);
      const now = Date.now();
      const nextTrucks: Record<string, TruckRender> = {};
      const parkingByVehicleKey = new Map<string, TruckRender>();
      const locationSlots = new Map<string, number>();
      let nextRoadSlots = createRoadPlaceholders(BASE_ROAD_SLOT_COUNT);
      const locationDetailsById = new Map<
        string,
        Pick<LocationNode, "label" | "company" | "fullAddress" | "city" | "province" | "country" | "meshType">
      >();

      for (const activity of allVehiclesResponse.data ?? []) {
        const key = getVehicleKey(activity);
        if (!key) continue;
        if (classifyActivityPlacement(activity) !== "unknown") continue;
        parkingByVehicleKey.set(String(key), {
          ...buildTruckFromActivity(activity, now),
          locationId: "PARKING_UNKNOWN",
          locationLabel: "Unknown location parking",
          slot: 0,
          status: "parked",
          changedAt: now
        });
      }

      for (const activity of latestByVehicle) {
        const activityVehicleKey = getVehicleKey(activity);
        if (activityVehicleKey) parkingByVehicleKey.delete(String(activityVehicleKey));
        const truck = buildTruckFromActivity(activity, now);
        const locationId = activity.location?.location_id;
        if (!locationId || isExitedLocationEvent(activity.event_type)) {
          nextRoadSlots = assignTruckToEarliestRoadPlaceholder(nextRoadSlots, truck);
          continue;
        }

        const resolvedLocationId = String(locationId);
        const nextSlot = locationSlots.get(resolvedLocationId) ?? 0;
        locationSlots.set(resolvedLocationId, nextSlot + 1);
        nextTrucks[truck.truckId] = {
          ...truck,
          locationId: resolvedLocationId,
          slot: nextSlot
        };
        locationDetailsById.set(resolvedLocationId, buildLocationDetails(activity));
      }

      const nextParkingTrucks = Array.from(parkingByVehicleKey.values()).map((truck, index) => ({
        ...truck,
        slot: index
      }));

      setRoadSlots(nextRoadSlots);
      setParkingTrucks(nextParkingTrucks);
      setTrucks(nextTrucks);
      setLocations((prevLocations) =>
        syncLocationsFromTrucks(prevLocations, nextTrucks).map((location) => {
          if (location.meshType === "placeholder") return location;
          const details = locationDetailsById.get(location.locationId);
          if (!details) return location;
          return { ...location, ...details };
        })
      );

      const nextHistory = latestByVehicle.slice(0, 50).map(buildEventFromActivity);
      setLatest(nextHistory[0] ?? null);
      setHistory(nextHistory);
      setApiError(null);
    };

    run();
    const intervalId = window.setInterval(run, ACTIVITY_API_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [debouncedSearchQuery, selectedMerchantId, session?.accessToken]);

  useEffect(() => {
    return () => {
      for (const timerId of roadTimersRef.current) window.clearTimeout(timerId);
      roadTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const leaving = locations.filter((location) => location.status === "leaving");
    if (leaving.length === 0) return;

    const nextRemovalAt = Math.min(...leaving.map((location) => location.changedAt + LOCATION_EXIT_MS));
    const delay = Math.max(0, nextRemovalAt - Date.now());

    const timeoutId = window.setTimeout(() => {
      setLocations((prev) =>
        prev.map((location) => {
          if (location.status !== "leaving") return location;
          if (Date.now() - location.changedAt < LOCATION_EXIT_MS) return location;
          return createPlaceholderNode(location.index, Date.now());
        })
      );
    }, delay + 16);

    return () => window.clearTimeout(timeoutId);
  }, [locations]);

  const visibleTypeSet = useMemo(() => new Set(visibleLocationTypes), [visibleLocationTypes]);
  const activeApiError =
    ACTIVITY_FEED_SOURCE === "api_endpoint" && !session?.accessToken
      ? "Missing session token for vehicle activity feed."
      : apiError;

  const filteredLocations = useMemo(
    () => locations.filter((location) => location.meshType === "placeholder" || visibleTypeSet.has(location.meshType)),
    [locations, visibleTypeSet]
  );

  const locationWaitStateById = useMemo(() => {
    const waitByLocationId = new Map<string, { isOverdue: boolean; overdueByMs: number; maxWaitingMs: number }>();
    const trucksAtLocation = new Map<string, TruckRender[]>();
    const defaultMaxWaitingMs = 30 * 60_000;

    for (const truck of Object.values(trucks)) {
      if (truck.status === "departing") continue;
      const existing = trucksAtLocation.get(truck.locationId) ?? [];
      existing.push(truck);
      trucksAtLocation.set(truck.locationId, existing);
    }

    for (const location of locations) {
      if (location.meshType === "placeholder") continue;
      const maxWaitingMs = location.maxWaitingMs ?? defaultMaxWaitingMs;
      const trucksHere = trucksAtLocation.get(location.locationId) ?? [];
      const longestWaitMs =
        trucksHere.length > 0 ? Math.max(...trucksHere.map((truck) => Math.max(0, timeTick - truck.changedAt))) : 0;
      const overdueByMs = Math.max(0, longestWaitMs - maxWaitingMs);
      waitByLocationId.set(location.locationId, {
        isOverdue: overdueByMs > 0,
        overdueByMs,
        maxWaitingMs
      });
    }

    return waitByLocationId;
  }, [locations, trucks, timeTick]);

  const decoratedFilteredLocations = useMemo(
    () =>
      filteredLocations.map((location) => {
        if (location.meshType === "placeholder") return location;
        const waitState = locationWaitStateById.get(location.locationId);
        if (!waitState) return location;
        return {
          ...location,
          maxWaitingMs: waitState.maxWaitingMs,
          isOverdue: waitState.isOverdue,
          overdueByMs: waitState.overdueByMs
        };
      }),
    [filteredLocations, locationWaitStateById]
  );

  const filteredLocationIds = useMemo(
    () => new Set(decoratedFilteredLocations.map((location) => location.locationId)),
    [decoratedFilteredLocations]
  );

  const truckList = useMemo(() => Object.values(trucks), [trucks]);
  const roadTruckList = useMemo(
    () =>
      roadSlots
        .filter((slot): slot is TruckRender => slot !== null)
        .map((truck) => ({ ...truck, isSpeeding: isTruckSpeeding(truck), isWaitingOverdue: false })),
    [roadSlots]
  );
  const parkingTruckList = useMemo(
    () => parkingTrucks.map((truck) => ({ ...truck, isSpeeding: isTruckSpeeding(truck), isWaitingOverdue: false })),
    [parkingTrucks]
  );

  const filteredTrucks = useMemo(
    () => truckList.filter((truck) => filteredLocationIds.has(truck.locationId)),
    [truckList, filteredLocationIds]
  );
  const decoratedFilteredTrucks = useMemo(
    () =>
      filteredTrucks.map((truck) => {
        const locationWaitState = locationWaitStateById.get(truck.locationId);
        const waitingDurationMs = Math.max(0, timeTick - truck.changedAt);
        const maxWaitingMs = locationWaitState?.maxWaitingMs ?? truck.maxWaitingMs ?? 30 * 60_000;
        const isWaitingOverdue =
          truck.status !== "departing" &&
          truck.status !== "arriving" &&
          truck.locationId !== "ON_ROAD" &&
          waitingDurationMs > maxWaitingMs;

        return {
          ...truck,
          isSpeeding: isTruckSpeeding(truck),
          isWaitingOverdue,
          maxWaitingMs,
          waitingDurationMs
        };
      }),
    [filteredTrucks, locationWaitStateById, timeTick]
  );
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const matchesRegNumber = useCallback(
    (truck: TruckRender) =>
      normalizedSearchQuery.length === 0 ||
      truck.plateNumber.toLowerCase().includes(normalizedSearchQuery),
    [normalizedSearchQuery]
  );
  const searchMatchedParkedTrucks = decoratedFilteredTrucks.filter(matchesRegNumber);
  const searchMatchedRoadTrucks = roadTruckList.filter(matchesRegNumber);
  const searchMatchedParkingTrucks = parkingTruckList.filter(matchesRegNumber);
  const searchedLocationIds = useMemo(
    () => new Set(searchMatchedParkedTrucks.map((truck) => truck.locationId)),
    [searchMatchedParkedTrucks]
  );
  const displayedLocations = useMemo(() => {
    if (!normalizedSearchQuery) return decoratedFilteredLocations;
    return decoratedFilteredLocations.filter(
      (location) => location.meshType !== "placeholder" && searchedLocationIds.has(location.locationId)
    );
  }, [decoratedFilteredLocations, normalizedSearchQuery, searchedLocationIds]);
  const displayedParkedTrucks = useMemo(
    () => (normalizedSearchQuery ? searchMatchedParkedTrucks : decoratedFilteredTrucks),
    [decoratedFilteredTrucks, normalizedSearchQuery, searchMatchedParkedTrucks]
  );
  const displayedRoadTrucks = useMemo(
    () => (normalizedSearchQuery ? searchMatchedRoadTrucks : roadTruckList),
    [normalizedSearchQuery, roadTruckList, searchMatchedRoadTrucks]
  );
  const displayedParkingTrucks = useMemo(
    () => (normalizedSearchQuery ? searchMatchedParkingTrucks : parkingTruckList),
    [normalizedSearchQuery, parkingTruckList, searchMatchedParkingTrucks]
  );
  const displayedRoadSlots = useMemo(
    () => displayedRoadTrucks.map((truck) => truck as TruckRender | null),
    [displayedRoadTrucks]
  );
  const totalVehicleCount = decoratedFilteredTrucks.length + roadTruckList.length + parkingTruckList.length;
  const searchResultsCount = displayedParkedTrucks.length + displayedRoadTrucks.length + displayedParkingTrucks.length;

  const locationTypeCounts = useMemo(() => {
    const counts: Record<FilterableLocationMeshType, number> = {
      warehouse: 0,
      workshop: 0,
      waypoint: 0,
      rest: 0,
      fuel: 0
    };

    for (const location of locations) {
      if (location.meshType !== "placeholder") counts[location.meshType] += 1;
    }

    return counts;
  }, [locations]);

  const warehouseTypeCount = useMemo(
    () => displayedLocations.filter((location) => location.meshType === "warehouse").length,
    [displayedLocations]
  );

  const selectedTruck = useMemo(() => {
    if (!selectedTruckId) return null;
    return (
      displayedParkedTrucks.find((truck) => truck.truckId === selectedTruckId) ??
      displayedRoadTrucks.find((truck) => truck.truckId === selectedTruckId) ??
      displayedParkingTrucks.find((truck) => truck.truckId === selectedTruckId) ??
      null
    );
  }, [selectedTruckId, displayedParkedTrucks, displayedRoadTrucks, displayedParkingTrucks]);
  const selectedLocation = useMemo(
    () =>
      selectedLocationId
        ? displayedLocations.find((location) => location.locationId === selectedLocationId) ?? null
        : null,
    [selectedLocationId, displayedLocations]
  );
  const selectedLocationTruckList = useMemo(
    () => (selectedLocation ? displayedParkedTrucks.filter((truck) => truck.locationId === selectedLocation.locationId) : []),
    [selectedLocation, displayedParkedTrucks]
  );

  const toggleLocationType = (type: FilterableLocationMeshType) => {
    setVisibleLocationTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== type);
      }
      return [...prev, type];
    });
  };

  const handleSearchSubmit = () => {
    const visibleTruck = displayedRoadTrucks[0] ?? displayedParkingTrucks[0] ?? displayedParkedTrucks[0] ?? null;

    if (visibleTruck) {
      setSelectedLocationId(null);
      setSelectedTruckId(visibleTruck.truckId);
      window.requestAnimationFrame(() => {
        sceneCameraApiRef.current?.setView("selected");
      });
    }
  };

  const openShipmentDialog = useCallback((shipmentId?: string | null) => {
    if (!shipmentId) return;
    setSelectedShipmentId(shipmentId);
  }, []);
  const openDriverDialog = useCallback((driverId?: string | null) => {
    if (!driverId) return;
    setSelectedDriverDetailId(driverId);
  }, []);
  const openLocationDialog = useCallback((locationId?: string | null) => {
    if (!locationId) return;
    setSelectedLocationDetailId(locationId);
  }, []);

  const detailLinkStyle = {
    color: "#1d4ed8",
    textDecoration: "none",
    fontWeight: 600
  } satisfies CSSProperties;
  const detailButtonStyle = {
    ...detailLinkStyle,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer"
  } satisfies CSSProperties;

  return (
    <div
      className="-m-6! overflow-hidden! relative rounded-lg"
      style={{
        position: "relative",
        height: "100vh",
        background: "linear-gradient(180deg, #a0a0a0 0%, #e1e1e1 45%, #e1e1e1 100%)"
      }}
    >
      <ActivitySummary
        filteredLocationsCount={displayedLocations.length}
        warehouseTypeCount={warehouseTypeCount}
        filteredTrucksCount={searchResultsCount}
        latest={latest}
        history={history}
      />
      {activeApiError ? (
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 390,
          zIndex: 2147483647,
          pointerEvents: "none",
          fontSize: 11,
          color: activeApiError ? "#b91c1c" : "#0f172a",
          background: "rgba(255,255,255,0.92)",
          border: `1px solid ${activeApiError ? "rgba(185,28,28,0.35)" : "rgba(15,23,42,0.12)"}`,
          borderRadius: 10,
          padding: "6px 10px"
        }}
      >
        {activeApiError ? ` • ${activeApiError}` : ""}
      </div>
      ) : null}

      <Canvas
        camera={{ position: [0, 22, 28], fov: 42 }}
        onPointerMissed={() => {
          setSelectedTruckId(null);
          setSelectedLocationId(null);
        }}
      >
        <ActivityScene
          locations={displayedLocations}
          trucks={displayedParkedTrucks}
          roadSlots={displayedRoadSlots}
          parkingTrucks={displayedParkingTrucks}
          showVehicleRegNumbers={showVehicleRegNumbers}
          showLocationLabels={showLocationLabels}
          selectedTruck={selectedTruck}
          onCameraApiReady={(api) => {
            sceneCameraApiRef.current = api;
            if (!hasInitializedDefaultViewRef.current) {
              hasInitializedDefaultViewRef.current = true;
              api.setView("overview");
            }
          }}
          onSelectTruck={(truckId) => {
            setSelectedLocationId(null);
            setSelectedTruckId(truckId);
          }}
          onSelectLocation={(locationId) => {
            setSelectedTruckId(null);
            setSelectedLocationId(locationId);
          }}
          onDepartDone={(truckId) => {
            setTrucks((prev) => {
              const current = prev[truckId];
              if (!current) return prev;

              const next = { ...prev };
              delete next[truckId];
              setLocations((prevLocations) => syncLocationsFromTrucks(prevLocations, next));

              const roadTruck: TruckRender = { ...current, status: "arriving", changedAt: Date.now() };
              setRoadSlots((prevRoad) => assignTruckToEarliestRoadPlaceholder(prevRoad, roadTruck));
              const departTimerId = window.setTimeout(() => {
                setRoadSlots((prevRoad) => updateRoadTruckStatus(prevRoad, truckId, "departing"));

                const roadExitTimerId = window.setTimeout(() => {
                  setRoadSlots((prevRoad) => replaceRoadTruckWithPlaceholder(prevRoad, truckId));
                }, ROAD_EXIT_ANIMATION_MS);
                roadTimersRef.current.push(roadExitTimerId);
              }, ROAD_DEPART_TRAVEL_MS);
              roadTimersRef.current.push(departTimerId);

              return next;
            });

            setSelectedTruckId((prev) => (prev === truckId ? null : prev));
          }}
        />
      </Canvas>

      {selectedTruck || selectedLocation ? (
        <div
          style={{
            position: "absolute",
            top: 66,
            right: 16,
            width: 340,
            zIndex: 2147483647,
            pointerEvents: "auto",
            background: "rgba(255,255,255,0.97)",
            border: "1px solid rgba(15, 23, 42, 0.12)",
            borderRadius: 14,
            padding: 14,
            boxShadow: "0 12px 35px rgba(15,23,42,0.16)",
            fontFamily: "ui-sans-serif, system-ui, -apple-system"
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (selectedTruck) {
                setSelectedTruckId(null);
                return;
              }
              setSelectedLocationId(null);
            }}
            aria-label={selectedTruck ? "Close truck details" : "Close location details"}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 28,
              height: 28,
              borderRadius: 999,
              border: "1px solid rgba(15,23,42,0.15)",
              background: "#fff",
              color: "#0f172a",
              fontSize: 17,
              lineHeight: "24px",
              cursor: "pointer"
            }}
          >
            ×
          </button>

          {selectedTruck ? (
            <>
	              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14, paddingRight: 24 }}>Truck details</div>
	              <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: "#0f172a" }}>
	                <div>
	                  {selectedTruck.vehicleId ? (
	                    <Link href={AdminRoute.vehicleDetails(selectedTruck.vehicleId)} style={detailLinkStyle}>
	                      {selectedTruck.plateNumber}
	                    </Link>
	                  ) : (
	                    selectedTruck.plateNumber
	                  )}
	                  {" • "}
	                  {selectedTruck.locationId !== "ON_ROAD" && selectedTruck.locationId !== "PARKING_UNKNOWN" ? (
                      <button
                        type="button"
                        onClick={() => openLocationDialog(selectedTruck.locationId)}
                        style={detailButtonStyle}
                      >
                        {selectedTruck.locationLabel ?? selectedTruck.locationId}
                      </button>
	                  ) : (
	                    selectedTruck.locationLabel ?? selectedTruck.locationId
	                  )}
	                </div>
	                <div style={{ color: "#64748b" }}>
	                  {selectedTruck.vehicleId ? (
	                    <Link href={AdminRoute.vehicleDetails(selectedTruck.vehicleId)} style={detailLinkStyle}>
	                      {selectedTruck.vehicleRefCode ?? selectedTruck.truckId}
	                    </Link>
	                  ) : (
	                    selectedTruck.vehicleRefCode ?? selectedTruck.truckId
	                  )}
	                  {selectedTruck.eventType ? (
	                    <>
	                      {" • "}
	                      {selectedTruck.vehicleId ? (
	                        <Link
	                          href={withAdminQuery(AdminLinks.vehicleActivities, { vehicle_id: selectedTruck.vehicleId })}
	                          style={detailLinkStyle}
	                        >
	                          {formatEventType(selectedTruck.eventType)}
	                        </Link>
	                      ) : (
	                        formatEventType(selectedTruck.eventType)
	                      )}
	                    </>
	                  ) : null}
	                </div>
	                <div style={{ color: "#64748b" }}>
	                  Driver:{" "}
	                  {selectedTruck.driverId ? (
                      <button
                        type="button"
                        onClick={() => openDriverDialog(selectedTruck.driverId)}
                        style={detailButtonStyle}
                      >
                        {selectedTruck.driver}
                      </button>
	                  ) : (
	                    selectedTruck.driver
	                  )}
	                </div>
	                {selectedTruck.driverIntegrationId ? (
	                  <div style={{ color: "#64748b" }}>
	                    Driver ref:{" "}
	                    {selectedTruck.driverId ? (
                        <button
                          type="button"
                          onClick={() => openDriverDialog(selectedTruck.driverId)}
                          style={detailButtonStyle}
                        >
                          {selectedTruck.driverIntegrationId}
                        </button>
	                    ) : (
	                      selectedTruck.driverIntegrationId
	                    )}
	                  </div>
	                ) : null}
                {selectedTruck.driverEmail ? (
                  <div style={{ color: "#64748b" }}>
                    Email:{" "}
                    <a href={`mailto:${selectedTruck.driverEmail}`} style={detailLinkStyle}>
                      {selectedTruck.driverEmail}
                    </a>
                  </div>
                ) : null}
                {selectedTruck.driverTelephone ? (
                  <div style={{ color: "#64748b" }}>
                    Phone:{" "}
                    <a href={`tel:${selectedTruck.driverTelephone}`} style={detailLinkStyle}>
                      {selectedTruck.driverTelephone}
                    </a>
                  </div>
                ) : null}
                {selectedTruck.speedKph !== null && selectedTruck.speedKph !== undefined ? (
                  <div style={{ color: "#64748b" }}>
                    Speed: {selectedTruck.speedKph} kph
                    {selectedTruck.speedLimitKph !== null && selectedTruck.speedLimitKph !== undefined
                      ? ` / ${selectedTruck.speedLimitKph} kph`
                      : ""}
                  </div>
                ) : null}
                {isTruckSpeeding(selectedTruck) ? (
                  <div style={{ color: "#b91c1c", fontWeight: 700 }}>
                    Speeding: {selectedTruck.speedKph} / {selectedTruck.speedLimitKph} kph
                  </div>
                ) : null}
                <div style={{ height: 1, background: "rgba(15,23,42,0.12)", margin: "4px 0" }} />
                <div style={{ fontWeight: 700 }}>Shipment</div>
                <div>
                  Reference:{" "}
                  {selectedTruck.shipmentRecord?.shipmentId ? (
                    <button
                      type="button"
                      onClick={() => openShipmentDialog(selectedTruck.shipmentRecord?.shipmentId)}
                      style={{
                        ...detailLinkStyle,
                        background: "none",
                        border: "none",
                        padding: 0,
                        cursor: "pointer"
                      }}
                    >
                      {selectedTruck.shipment.reference}
                    </button>
                  ) : (
                    selectedTruck.shipment.reference
                  )}
                </div>
                <div>{selectedTruck.shipment.description}</div>
                {/* <div>
                  {selectedTruck.shipment.weightKg.toLocaleString()} kg • {selectedTruck.shipment.pallets} pallets
                </div> */}
                <div>
                  Destination:{" "}
                  {selectedTruck.locationId !== "ON_ROAD" && selectedTruck.locationId !== "PARKING_UNKNOWN" ? (
                    <button
                      type="button"
                      onClick={() => openLocationDialog(selectedTruck.locationId)}
                      style={detailButtonStyle}
                    >
                      {selectedTruck.shipment.destination}
                    </button>
                  ) : (
                    selectedTruck.shipment.destination
                  )}
                </div>
                
                {selectedTruck.shipmentRecord ? (
	                  <>
	                    <div style={{ height: 1, background: "rgba(15,23,42,0.12)", margin: "4px 0" }} />
	                    <div style={{ fontWeight: 700 }}>Shipment</div>
	                    <div>
	                      Shipment ref:{" "}
                      {selectedTruck.shipmentRecord.shipmentId ? (
                          <button
                            type="button"
                            onClick={() => openShipmentDialog(selectedTruck.shipmentRecord?.shipmentId)}
                            style={{
                              ...detailLinkStyle,
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer"
                            }}
                          >
                            {selectedTruck.shipmentRecord.merchantOrderRef ?? selectedTruck.shipmentRecord.shipmentId}
                          </button>
                        ) : (
	                        selectedTruck.shipmentRecord.merchantOrderRef ?? "-"
	                      )}
	                    </div>
	                    <div>
                        Status:{" "}
                        {selectedTruck.shipmentRecord.shipmentId ? (
                          <button
                            type="button"
                            onClick={() => openShipmentDialog(selectedTruck.shipmentRecord?.shipmentId)}
                            style={{
                              ...detailLinkStyle,
                              background: "none",
                              border: "none",
                              padding: 0,
                              cursor: "pointer"
                            }}
                          >
                            {selectedTruck.shipmentRecord.status ?? "-"}
                          </button>
                        ) : (
                          selectedTruck.shipmentRecord.status ?? "-"
                        )}
                      </div>
	                  </>
	                ) : null}
              </div>
            </>
          ) : selectedLocation ? (
            <>
	              <div style={{ fontWeight: 800, color: "#0f172a", fontSize: 14, paddingRight: 24 }}>Location details</div>
	              <div style={{ marginTop: 8, display: "grid", gap: 4, fontSize: 12, color: "#0f172a" }}>
	                <div>
                    <button
                      type="button"
                      onClick={() => openLocationDialog(selectedLocation.locationId)}
                      style={detailButtonStyle}
                    >
                      {selectedLocation.label ?? selectedLocation.locationId}
                    </button>
	                  •
	                  {selectedLocation.city ? `${selectedLocation.city}, ` : ""}                  {selectedLocation.province ? `${selectedLocation.province}, ` : ""}
	                  {selectedLocation.country ?? ""}
                </div>
                {selectedLocation.company ? <div style={{ color: "#64748b" }}>Company: {selectedLocation.company}</div> : null}
                <div style={{ color: "#64748b" }}>Type: {selectedLocation.meshType}</div>
                <div style={{ color: "#64748b" }}>Status: {selectedLocation.status}</div>
                {selectedLocation.maxWaitingMs ? (
                  <div style={{ color: selectedLocation.isOverdue ? "#b91c1c" : "#64748b" }}>
                    Max waiting: {formatDurationMs(selectedLocation.maxWaitingMs)}
                  </div>
                ) : null}
                {selectedLocation.overdueByMs ? (
                  <div style={{ color: "#b91c1c", fontWeight: 700 }}>
                    Overdue by: {formatDurationMs(selectedLocation.overdueByMs)}
                  </div>
                ) : null}
                {/* <div style={{ color: "#64748b" }}>Index: {selectedLocation.index}</div> */}
                {selectedLocation.fullAddress ? <div style={{ color: "#64748b" }}>{selectedLocation.fullAddress}</div> : null}
                <div style={{ height: 1, background: "rgba(15,23,42,0.12)", margin: "4px 0" }} />
	                <div style={{ fontWeight: 700 }}>Trucks at location: {selectedLocationTruckList.length}</div>
	                {selectedLocationTruckList.slice(0, 5).map((truck) => (
	                  <div key={`loc-truck-${truck.truckId}`} style={{ color: "#334155" }}>
	                    {truck.vehicleId ? (
	                      <Link href={AdminRoute.vehicleDetails(truck.vehicleId)} style={detailLinkStyle}>
	                        {truck.plateNumber}
	                      </Link>
	                    ) : (
	                      truck.plateNumber
	                    )}{" "}
	                    • {truck.vehicleRefCode ?? truck.truckId} •{" "}
	                    {truck.driverId ? (
                        <button
                          type="button"
                          onClick={() => openDriverDialog(truck.driverId)}
                          style={detailButtonStyle}
                        >
                          {truck.driver}
                        </button>
	                    ) : (
	                      truck.driver
	                    )}
	                  </div>
	                ))}
                {selectedLocationTruckList.length > 5 ? (
                  <div style={{ color: "#64748b" }}>+{selectedLocationTruckList.length - 5} more trucks</div>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      <div style={{ position: "absolute", top: 16, right: 16, zIndex: 2147483647, pointerEvents: "auto", display: "flex", gap: 8 }}>
        <ViewPresetControls
          onSelect={(view) => {
            sceneCameraApiRef.current?.setView(view);
          }}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          totalVehicles={totalVehicleCount}
          searchResultsCount={searchResultsCount}
        />
        <FilterLocationsDialog
          isOpen={isFilterDialogOpen}
          onOpenChange={setIsFilterDialogOpen}
          visibleTypeSet={visibleTypeSet}
          visibleLocationTypes={visibleLocationTypes}
          locationTypeCounts={locationTypeCounts}
          toggleLocationType={toggleLocationType}
          showVehicleRegNumbers={showVehicleRegNumbers}
          onShowVehicleRegNumbersChange={setShowVehicleRegNumbers}
          showLocationLabels={showLocationLabels}
          onShowLocationLabelsChange={setShowLocationLabels}
        />
      </div>

      <div
        style={{
          position: "absolute",
          right: 16,
          bottom: 16,
          zIndex: 2147483647,
          pointerEvents: "auto",
          display: "grid",
          gap: 8
        }}
      >
        <Button
          variant="outline"
          className="h-9 w-9 p-0"
          aria-label="Zoom in"
          
          onClick={() => sceneCameraApiRef.current?.zoomIn()}
        >
          +
        </Button>
        <Button
          variant="outline"
          className="h-9 w-9 p-0"
          aria-label="Zoom out"
          onClick={() => sceneCameraApiRef.current?.zoomOut()}
          
          
        >
          -
        </Button>
      </div>

      {session?.accessToken ? (
        <>
          <ShipmentMapDialog
            open={Boolean(selectedShipmentId)}
            shipmentId={selectedShipmentId}
            accessToken={session.accessToken}
            merchantId={selectedMerchantId}
            onOpenChange={(open) => {
              if (!open) setSelectedShipmentId(null);
            }}
          />
          <DriverMapDialog
            open={Boolean(selectedDriverDetailId)}
            driverId={selectedDriverDetailId}
            accessToken={session.accessToken}
            merchantId={selectedMerchantId}
            onOpenChange={(open) => {
              if (!open) setSelectedDriverDetailId(null);
            }}
          />
          <LocationMapDialog
            open={Boolean(selectedLocationDetailId)}
            locationId={selectedLocationDetailId}
            accessToken={session.accessToken}
            merchantId={selectedMerchantId}
            onOpenChange={(open) => {
              if (!open) setSelectedLocationDetailId(null);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
