import { importLibrary, setOptions } from "@googlemaps/js-api-loader"

let configured = false

export async function loadGoogleMaps(libraries = []) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
  if (!apiKey) {
    throw new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
  }

  if (!configured) {
    setOptions({
      key: apiKey,
      version: "weekly",
    })
    configured = true
  }

  await importLibrary("maps")
  for (const lib of libraries) {
    await importLibrary(lib)
  }
}
