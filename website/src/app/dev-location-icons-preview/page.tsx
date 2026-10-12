import { notFound } from "next/navigation"
import TruckPreview from "../../../tests/fixtures/truck-preview"
import LocationIconsPreview from "../../../tests/fixtures/location-icons-preview"

export default async function Page({ searchParams }: { searchParams: Promise<{ render?: string; icon?: string; truck?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound()
  const params = await searchParams
  if (params.truck === "1") return <TruckPreview />
  return <LocationIconsPreview renderModels={params.render === "1"} iconValue={params.icon} />
}
