import { notFound } from "next/navigation"
import SchedulePreview from "../../../tests/fixtures/schedule-preview"

// Isolated sample data, never an authenticated or production schedule.
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <SchedulePreview />
}
