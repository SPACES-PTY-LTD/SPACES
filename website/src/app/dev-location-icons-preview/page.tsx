import { notFound } from "next/navigation"
import LocationIconsPreview from "../../../tests/fixtures/location-icons-preview"

export default async function Page({ searchParams }: { searchParams: Promise<{ render?: string; icon?: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound()
  const params = await searchParams
  return <LocationIconsPreview renderModels={params.render === "1"} iconValue={params.icon} />
}
