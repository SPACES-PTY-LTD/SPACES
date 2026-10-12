export const LOCATION_TYPE_ICONS = [
  { value: "warehouse", label: "Warehouse", meshType: "warehouse", image: "/images/location-types/warehouse.png" },
  { value: "workshop", label: "Truck workshop", meshType: "workshop", image: "/images/location-types/workshop.png" },
  { value: "waypoint", label: "Waypoint", meshType: "waypoint", image: "/images/location-types/waypoint.png" },
  { value: "restarea", label: "Rest area", meshType: "rest", image: "/images/location-types/restarea.png" },
  { value: "fuel", label: "Fuel station", meshType: "fuel", image: "/images/location-types/fuel.png" },
  { value: "container-terminal", label: "Container terminal", meshType: "container-terminal", image: "/images/location-types/container-terminal.png" },
  { value: "seaport", label: "Seaport", meshType: "seaport", image: "/images/location-types/seaport.png" },
  { value: "airport-cargo", label: "Airport cargo terminal", meshType: "airport-cargo", image: "/images/location-types/airport-cargo.png" },
  { value: "rail-freight", label: "Rail freight terminal", meshType: "rail-freight", image: "/images/location-types/rail-freight.png" },
  { value: "mine", label: "Mine", meshType: "mine", image: "/images/location-types/mine.png" },
  { value: "quarry", label: "Quarry", meshType: "quarry", image: "/images/location-types/quarry.png" },
  { value: "factory", label: "Factory", meshType: "factory", image: "/images/location-types/factory.png" },
  { value: "farm", label: "Farm", meshType: "farm", image: "/images/location-types/farm.png" },
  { value: "grain-terminal", label: "Grain terminal", meshType: "grain-terminal", image: "/images/location-types/grain-terminal.png" },
  { value: "cold-storage", label: "Cold storage facility", meshType: "cold-storage", image: "/images/location-types/cold-storage.png" },
  { value: "retail", label: "Retail delivery point", meshType: "retail", image: "/images/location-types/retail.png" },
  { value: "construction", label: "Construction site", meshType: "construction", image: "/images/location-types/construction.png" },
  { value: "weighbridge", label: "Weighbridge", meshType: "weighbridge", image: "/images/location-types/weighbridge.png" },
  { value: "border", label: "Border checkpoint", meshType: "border", image: "/images/location-types/border.png" },
  { value: "toll-plaza", label: "Toll plaza", meshType: "toll-plaza", image: "/images/location-types/toll-plaza.png" },
  { value: "fuel-station-2", label: "Fuel station 2", meshType: "fuel-station-2", image: "/images/location-types/fuel-station-2.png" },
  { value: "fuel-depot", label: "Fuel depot", meshType: "fuel-depot", image: "/images/location-types/fuel-depot.png" },
  { value: "staging-area", label: "Staging area", meshType: "staging-area", image: "/images/location-types/staging-area.png" },
] as const

export type LocationIconMeshType = (typeof LOCATION_TYPE_ICONS)[number]["meshType"]

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
