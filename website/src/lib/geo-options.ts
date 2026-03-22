export type CountryOption = {
  code: string
  name: string
}

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "ZA", name: "South Africa" },
  { code: "AU", name: "Australia" },
  { code: "NZ", name: "New Zealand" },
  { code: "NG", name: "Nigeria" },
  { code: "KE", name: "Kenya" },
  { code: "IN", name: "India" },
  { code: "AE", name: "United Arab Emirates" },
]

const NON_COUNTRY_REGION_CODES = new Set([
  "EU",
  "EZ",
  "UN",
  "XA",
  "XB",
  "XC",
  "XD",
  "XE",
  "XF",
  "XG",
  "XH",
  "XI",
  "XJ",
  "XL",
  "XM",
  "XN",
  "XO",
  "XP",
  "XQ",
  "XR",
  "XS",
  "XT",
  "XU",
  "XV",
  "XW",
  "XX",
  "XZ",
])

const FALLBACK_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Africa/Johannesburg",
]

export function getDefaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

export function getTimezones() {
  if (typeof Intl.supportedValuesOf === "function") {
    const values = Intl.supportedValuesOf("timeZone")
    if (values.length > 0) {
      return values
    }
  }

  return FALLBACK_TIMEZONES
}

export function getCountryOptions() {
  if (typeof Intl.DisplayNames !== "function") {
    return FALLBACK_COUNTRIES
  }

  const displayNames = new Intl.DisplayNames(["en"], { type: "region" })
  const values: CountryOption[] = []
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

  for (const firstChar of alphabet) {
    for (const secondChar of alphabet) {
      const code = `${firstChar}${secondChar}`
      if (NON_COUNTRY_REGION_CODES.has(code)) continue
      const name = displayNames.of(code)
      if (!name || name === code) continue
      values.push({ code, name })
    }
  }

  if (values.length === 0) {
    return FALLBACK_COUNTRIES
  }

  return values.sort((a, b) => a.name.localeCompare(b.name))
}
