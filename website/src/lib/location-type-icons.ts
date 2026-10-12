export type LocationIconMeshType = "warehouse" | "workshop" | "waypoint" | "rest" | "fuel"

export const LOCATION_TYPE_ICONS = [
  { value: "warehouse", label: "Warehouse", meshType: "warehouse", image: "/images/location-types/warehouse.png" },
  { value: "workshop", label: "Truck workshop", meshType: "workshop", image: "/images/location-types/workshop.png" },
  { value: "waypoint", label: "Waypoint", meshType: "waypoint", image: "/images/location-types/waypoint.png" },
  { value: "restarea", label: "Rest area", meshType: "rest", image: "/images/location-types/restarea.png" },
  { value: "fuel", label: "Fuel station", meshType: "fuel", image: "/images/location-types/fuel.png" },
] as const satisfies ReadonlyArray<{ value: string; label: string; meshType: LocationIconMeshType; image: string }>

export type LocationTypeIconValue = (typeof LOCATION_TYPE_ICONS)[number]["value"]

export function findLocationTypeIcon(icon?: string | null) {
  const normalized = icon?.trim().toLowerCase()
  return LOCATION_TYPE_ICONS.find((entry) => entry.value === normalized)
}

export function getLocationTypeIconPreview(icon?: string | null) {
  return findLocationTypeIcon(icon) ?? LOCATION_TYPE_ICONS[0]
}

export function resolveLocationMeshType(icon?: string | null): LocationIconMeshType {
  return getLocationTypeIconPreview(icon).meshType
}
