import type { Location } from "@/lib/types"

export async function loadGeofenceLocations(
  ids: string[], cache: Map<string, Location>,
  fetchLocation: (id: string) => Promise<Location>,
  isCancelled: () => boolean,
) {
  let failed = false
  const uniqueIds = [...new Set(ids)]
  const queue = uniqueIds.filter(id => !cache.has(id))
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length && !isCancelled()) {
      const id = queue.shift()!
      try {
        const location = await fetchLocation(id)
        if (isCancelled()) return
        cache.set(id, location)
      } catch { failed = true }
    }
  }))
  return { failed, locations: uniqueIds.flatMap(id => cache.has(id) ? [cache.get(id)!] : []) }
}
