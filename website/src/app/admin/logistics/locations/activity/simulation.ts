import {
  DRIVERS,
  LOAD_DESTINATIONS,
  LOAD_TYPES,
  LOCATION_CATEGORIES,
  SEEDED_LOCATIONS
} from "./constants";
import type {
  LocationCategory,
  LocationMeshType,
  LocationNode,
  TruckEvent,
  TruckShipment,
  TruckRender
} from "./types";

function randomOf<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function getLocationCategory(locationId: string): LocationCategory {
  const prefix = locationId.split("-")[0]?.toLowerCase();
  if (prefix === "slot") return "placeholder";
  if (
    prefix === "depot" ||
    prefix === "pickup" ||
    prefix === "dropoff" ||
    prefix === "service" ||
    prefix === "waypoint" ||
    prefix === "break" ||
    prefix === "fuel"
  ) {
    return prefix;
  }
  return "depot";
}

function getLocationMeshType(category: LocationCategory): LocationMeshType {
  if (category === "depot" || category === "pickup" || category === "dropoff") return "warehouse";
  if (category === "service") return "workshop";
  if (category === "waypoint") return "waypoint";
  if (category === "break") return "rest";
  if (category === "placeholder") return "placeholder";
  return "fuel";
}

function hashLocationId(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function getDefaultLocationMaxWaitingMs(locationId: string, category: LocationCategory): number {
  const rangeByCategory: Record<Exclude<LocationCategory, "placeholder">, { min: number; max: number }> = {
    depot: { min: 20 * 60_000, max: 45 * 60_000 },
    pickup: { min: 10 * 60_000, max: 25 * 60_000 },
    dropoff: { min: 10 * 60_000, max: 25 * 60_000 },
    service: { min: 30 * 60_000, max: 75 * 60_000 },
    waypoint: { min: 8 * 60_000, max: 20 * 60_000 },
    break: { min: 15 * 60_000, max: 35 * 60_000 },
    fuel: { min: 12 * 60_000, max: 30 * 60_000 }
  };

  if (category === "placeholder") return 30 * 60_000;

  const range = rangeByCategory[category];
  const spread = range.max - range.min;
  if (spread <= 0) return range.min;
  const ratio = hashLocationId(locationId) / 0xffffffff;
  return Math.round(range.min + ratio * spread);
}

export function createLocationNode(locationId: string, index: number, changedAt = Date.now()): LocationNode {
  const category = getLocationCategory(locationId);
  return {
    locationId,
    index,
    category,
    meshType: getLocationMeshType(category),
    status: "active",
    changedAt,
    maxWaitingMs: getDefaultLocationMaxWaitingMs(locationId, category)
  };
}

export function createPlaceholderNode(index: number, changedAt = Date.now()): LocationNode {
  return createLocationNode(`SLOT-${String(index).padStart(3, "0")}`, index, changedAt);
}

export function createPlateNumber(truckId: string): string {
  const suffix = truckId.split("-")[1] ?? "0000";
  return `GP-${suffix.padStart(4, "0")}`;
}

export function createLoadForTruck(truckId: string): TruckShipment {
  const suffix = truckId.split("-")[1] ?? truckId;
  return {
    reference: `LD-${suffix}-${Math.floor(100 + Math.random() * 900)}`,
    description: randomOf(LOAD_TYPES),
    destination: randomOf(LOAD_DESTINATIONS),
    weightKg: Math.floor(4000 + Math.random() * 18000),
    pallets: Math.floor(4 + Math.random() * 22),
    temperatureControlled: Math.random() < 0.28
  };
}

export function createInitialUnknownParkingTrucks(count = 8): TruckRender[] {
  const now = Date.now();
  return Array.from({ length: count }).map((_, index) => {
    const truckId = `TRK-U${String(index + 1).padStart(3, "0")}`;
    return {
      truckId,
      plateNumber: createPlateNumber(truckId),
      locationId: "PARKING_UNKNOWN",
      locationLabel: "Unknown location parking",
      slot: index,
      status: "parked",
      changedAt: now,
      driver: randomOf(DRIVERS),
      shipment: {
        ...createLoadForTruck(truckId),
        destination: "Unknown location"
      },
      vehicleRefCode: `UNK-${index + 1}`,
      shipmentRecord: null
    };
  });
}

export function startTruckStream(onEvent: (event: TruckEvent) => void) {
  const HOTSPOT_LOCATION_ID = "DEPOT-01";
  const HOTSPOT_TARGET_TRUCKS = 18;
  const HOTSPOT_BIAS = 0.78;
  let truckCounter = 1001;
  const locationCounterByCategory = new Map<LocationCategory, number>(
    LOCATION_CATEGORIES.map((category) => [category, 2])
  );

  const activeTrucks = new Map<string, { locationId: string; driver: string }>();
  const knownLocations = new Set<string>(SEEDED_LOCATIONS);
  const speedLimits = [60, 80, 100];
  const SPEEDING_BIAS = 0.62;

  const makeLocation = () => {
    const hotspotCount = Array.from(activeTrucks.values()).filter(
      (truck) => truck.locationId === HOTSPOT_LOCATION_ID
    ).length;
    if (
      hotspotCount < HOTSPOT_TARGET_TRUCKS &&
      (activeTrucks.size < HOTSPOT_TARGET_TRUCKS || Math.random() < HOTSPOT_BIAS)
    ) {
      knownLocations.add(HOTSPOT_LOCATION_ID);
      return HOTSPOT_LOCATION_ID;
    }

    if (Math.random() < 0.35) {
      const category = randomOf(LOCATION_CATEGORIES);
      const nextNumber = locationCounterByCategory.get(category) ?? 2;
      locationCounterByCategory.set(category, nextNumber + 1);
      const id = `${category.toUpperCase()}-${String(nextNumber).padStart(2, "0")}`;
      knownLocations.add(id);
      return id;
    }

    return randomOf(Array.from(knownLocations));
  };

  const emitArrival = () => {
    const truckId = `TRK-${truckCounter++}`;
    const locationId = makeLocation();
    const driver = randomOf(DRIVERS);

    activeTrucks.set(truckId, { locationId, driver });

    const speedLimitKph = randomOf(speedLimits);
    const speedKph = Math.floor(Math.random() * 16);

    onEvent({
      truckId,
      locationId,
      driver,
      action: "ARRIVE",
      timestamp: new Date().toISOString(),
      eventType: "entered_location",
      speedKph,
      speedLimitKph
    });
  };

  const emitDeparture = () => {
    const truckId = randomOf(Array.from(activeTrucks.keys()));
    const truck = activeTrucks.get(truckId);
    if (!truck) return;

    activeTrucks.delete(truckId);

    const speedLimitKph = randomOf(speedLimits);
    const isSpeeding = Math.random() < SPEEDING_BIAS;
    const minSpeed = isSpeeding ? speedLimitKph + 4 : Math.floor(speedLimitKph * 0.35);
    const maxSpeed = isSpeeding ? Math.floor(speedLimitKph * 1.6) : Math.floor(speedLimitKph * 0.98);
    const speedKph = Math.floor(minSpeed + Math.random() * Math.max(maxSpeed - minSpeed + 1, 1));
    const eventType = isSpeeding ? "speeding" : "exited_location";

    onEvent({
      truckId,
      locationId: truck.locationId,
      driver: truck.driver,
      action: "DEPART",
      timestamp: new Date().toISOString(),
      eventType,
      speedKph,
      speedLimitKph
    });
  };

  const tick = () => {
    const shouldArrive = activeTrucks.size < 10 || Math.random() < 0.84;
    if (shouldArrive) emitArrival();
    else emitDeparture();
  };

  tick();
  const id = window.setInterval(tick, 950);
  return () => window.clearInterval(id);
}

export function syncLocationsFromTrucks(
  prevLocations: LocationNode[],
  nextTrucks: Record<string, TruckRender>
): LocationNode[] {
  const now = Date.now();
  const activeLocationIds = Array.from(new Set(Object.values(nextTrucks).map((truck) => truck.locationId)));
  const activeSet = new Set(activeLocationIds);

  const nextLocations: LocationNode[] = prevLocations.map((location): LocationNode => {
    if (location.meshType === "placeholder") return location;

    const isActive = activeSet.has(location.locationId);
    if (isActive) {
      return location.status === "active"
        ? location
        : {
            ...location,
            status: "active",
            changedAt: now
          };
    }

    return location.status === "leaving"
      ? location
      : {
          ...location,
          status: "leaving",
          changedAt: now
        };
  });

  const assignedIds = new Set(
    nextLocations.filter((location) => location.meshType !== "placeholder").map((location) => location.locationId)
  );

  for (const locationId of activeLocationIds) {
    if (assignedIds.has(locationId)) continue;

    const placeholderIndex = nextLocations
      .filter((location) => location.meshType === "placeholder")
      .sort((a, b) => a.index - b.index)[0]?.index;

    if (placeholderIndex !== undefined) {
      const target = nextLocations.findIndex((location) => location.index === placeholderIndex);
      if (target !== -1) {
        nextLocations[target] = createLocationNode(locationId, placeholderIndex, now);
        assignedIds.add(locationId);
      }
      continue;
    }

    const maxIndex = nextLocations.reduce((max, location) => Math.max(max, location.index), -1);
    nextLocations.push(createLocationNode(locationId, maxIndex + 1, now));
    assignedIds.add(locationId);
  }

  return [...nextLocations].sort((a, b) => a.index - b.index);
}
