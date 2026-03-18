import type { Location } from "@/lib/types"

export function formatAddress(location?: Location | null) {
  if (!location) return ""

  const parts = [
    location.address_line_1,
    location.address_line_2,
    location.city ?? location.town,
    location.province,
    location.post_code,
    location.country,
  ].filter((part): part is string => Boolean(part))

  if (parts.length > 0) {
    return parts.join(", ")
  }

  return location.full_address ?? ""
}

export function getLocationLabel(location?: Location | null) {
  if (!location) return "-"
  return  (formatAddress(location) || "-")
}
