import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <div className="text-sm font-semibold">Driver Console</div>
        <div className="flex items-center gap-2 text-sm">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/driver/bookings">Bookings</Link>
          </Button>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/driver/vehicles">Vehicles</Link>
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-6">{children}</main>
    </div>
  )
}
