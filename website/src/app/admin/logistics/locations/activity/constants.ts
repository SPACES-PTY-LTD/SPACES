import type { FilterableLocationMeshType, LocationCategory } from "./types";

export type ActivityFeedSource = "dummy" | "api_endpoint";
export const ACTIVITY_FEED_SOURCE: ActivityFeedSource = "api_endpoint";
export const ACTIVITY_API_POLL_INTERVAL_MS = 60_000;

export const DRIVERS = ["A. Ndlovu", "S. Patel", "J. Smith", "T. Mokoena", "L. Naidoo"];

export const LOCATION_CATEGORIES: LocationCategory[] = [
  "depot",
  "pickup",
  "dropoff",
  "service",
  "waypoint",
  "break",
  "fuel"
];

export const SEEDED_LOCATIONS = [
  "DEPOT-01",
  "PICKUP-01",
  "DROPOFF-01",
  "SERVICE-01",
  "WAYPOINT-01",
  "BREAK-01",
  "FUEL-01"
];

export const TRUCKS_PER_WAREHOUSE_ROW = 4;
export const TRUCK_ROW_GAP = 2.5;
export const TRUCK_PARK_Z = 2.6;
export const ROAD_COLUMNS_PER_ROW = 10;
export const BASE_ROAD_LANE_COUNT = 3;

export const LOCATION_ENTER_MS = 420;
export const LOCATION_EXIT_MS = 360;

export const LOAD_TYPES = ["Dry groceries", "Pharmaceuticals", "Consumer electronics", "Fresh produce", "Auto spares"];
export const LOAD_DESTINATIONS = ["JHB Hub", "CPT Port", "DBN DC", "PE Crossdock", "BFN Depot"];

export const LOCATION_MESH_TYPE_OPTIONS: Array<{ value: FilterableLocationMeshType; label: string }> = [
  { value: "warehouse", label: "Warehouse" },
  { value: "workshop", label: "Truck workshop" },
  { value: "waypoint", label: "Waypoint" },
  { value: "rest", label: "Rest area" },
  { value: "fuel", label: "Fuel station" }
];
