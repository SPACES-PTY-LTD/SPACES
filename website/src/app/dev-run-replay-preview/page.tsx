import { notFound } from "next/navigation"
import RunReplayPreview from "../../../tests/fixtures/run-replay-preview"

// Local visual verification only: never expose illustrative data as a production run.
export default function Page() {
  if (process.env.NODE_ENV !== "development") notFound()
  return <RunReplayPreview />
}
