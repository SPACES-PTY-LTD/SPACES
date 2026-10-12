import type { Location, ShipmentStop } from "@/lib/types"

export function recordedStopCoordinates(stop: ShipmentStop) {
  // Prefer the observation; only fall back to a complete location coordinate pair.
  for (const pair of [[stop.latitude, stop.longitude], [stop.location?.latitude, stop.location?.longitude]]) {
    const [lat, lng] = pair
    if (typeof lat === "number" && Number.isFinite(lat) && Math.abs(lat) <= 90 &&
        typeof lng === "number" && Number.isFinite(lng) && Math.abs(lng) <= 180) return { lat, lng }
  }
  return null
}

export function recordedStopLocationValues(stop: ShipmentStop, address?: google.maps.GeocoderResult): Partial<Location> {
  const coordinates = recordedStopCoordinates(stop)
  const component = (type: string) => address?.address_components.find(item => item.types.includes(type))?.long_name || ""
  const street = [component("street_number"), component("route")].filter(Boolean).join(" ")
  return {
    name: stop.location?.name || stop.location?.company || street || address?.formatted_address || "",
    company: stop.location?.company || "",
    code: stop.location?.code || "",
    address_line_1: stop.location?.full_address || street || address?.formatted_address || "",
    address_line_2: component("subpremise"),
    town: component("sublocality") || component("sublocality_level_1") || component("neighborhood"),
    city: stop.location?.city || component("locality") || component("postal_town"),
    province: stop.location?.province || component("administrative_area_level_1"),
    country: stop.location?.country || component("country"),
    post_code: component("postal_code"),
    google_place_id: address?.place_id || "",
    latitude: coordinates?.lat ?? null,
    longitude: coordinates?.lng ?? null,
  }
}
