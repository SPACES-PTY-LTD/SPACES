export type TruckAction = "ARRIVE" | "DEPART";
export type TruckStatus = "arriving" | "parked" | "departing";

export type TruckEvent = {
  truckId: string;
  locationId: string;
  driver: string;
  driverId?: string | null;
  driverEmail?: string | null;
  driverTelephone?: string | null;
  driverIntegrationId?: string | null;
  action: TruckAction;
  timestamp: string;
  eventType?: string;
  activityId?: string;
  locationLabel?: string;
  speedKph?: number | null;
  speedLimitKph?: number | null;
};

export type LocationCategory =
  | "depot"
  | "pickup"
  | "dropoff"
  | "service"
  | "waypoint"
  | "break"
  | "fuel"
  | "placeholder";

export type LocationMeshType = "warehouse" | "workshop" | "waypoint" | "rest" | "fuel" | "placeholder";
export type FilterableLocationMeshType = Exclude<LocationMeshType, "placeholder">;

export type LocationNode = {
  locationId: string;
  index: number;
  category: LocationCategory;
  meshType: LocationMeshType;
  status: "active" | "leaving";
  changedAt: number;
  maxWaitingMs?: number;
  isOverdue?: boolean;
  overdueByMs?: number;
  label?: string;
  company?: string | null;
  fullAddress?: string | null;
  city?: string | null;
  province?: string | null;
  country?: string | null;
};

export type TruckShipment = {
  reference: string;
  description: string;
  destination: string;
  weightKg: number;
  pallets: number;
  temperatureControlled: boolean;
};

export type TruckRender = {
  truckId: string;
  vehicleId?: string | null;
  plateNumber: string;
  locationId: string;
  locationLabel?: string;
  slot: number;
  status: TruckStatus;
  changedAt: number;
  driver: string;
  driverId?: string | null;
  driverEmail?: string | null;
  driverTelephone?: string | null;
  driverIntegrationId?: string | null;
  shipment: TruckShipment;
  eventType?: string;
  speedKph?: number | null;
  speedLimitKph?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  occurredAt?: string | null;
  vehicleRefCode?: string | null;
  vehicleLabel?: string;
  isSpeeding?: boolean;
  isWaitingOverdue?: boolean;
  maxWaitingMs?: number;
  waitingDurationMs?: number;
  shipmentRecord?: {
    shipmentId?: string;
    merchantOrderRef?: string | null;
    status?: string | null;
    autoCreated?: boolean;
  } | null;
};
