import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { API_BASE_URL, getFirstApiEndpointPath } from "@/lib/docs/api-reference"

const highlights = [
  {
    title: "Base URL",
    value: API_BASE_URL,
    description: "All requests in this guide use the production API host.",
  },
  {
    title: "Authentication",
    value: "Bearer token",
    description: "Send `Authorization: Bearer <token>` on protected endpoints.",
  },
  {
    title: "Rate limits",
    value: "Header based",
    description:
      "Monitor `X-RateLimit-*` response headers and back off on `429 Too Many Requests`.",
  },
]

export default function DocsHomePage() {
  const firstEndpointPath = getFirstApiEndpointPath()

  return (
    <div className="space-y-9">
      <section className="space-y-4">
        <Badge className="bg-zinc-900 text-zinc-50 hover:bg-zinc-900">Public Merchant API</Badge>
        <h1 className="max-w-3xl text-[36px] font-semibold leading-tight tracking-tight text-zinc-900">
          Integrate shipments, quotes, bookings, and on-demand delivery from one API.
        </h1>
        <p className="max-w-3xl text-sm leading-6 text-zinc-600">
          Use this documentation to authenticate, request quotes, create shipments,
          book deliveries, and subscribe to webhook events.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href={firstEndpointPath}>
              Browse endpoints
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/docs/api-reference">API Reference index</Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {highlights.map((item) => (
          <Card key={item.title} className="border-zinc-200/80 bg-white">
            <CardHeader className="pb-3">
              <CardTitle className="text-base tracking-tight text-zinc-900">{item.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-sm text-zinc-700 [font-family:var(--font-docs-mono)]">
                {item.value}
              </p>
              <p className="text-sm text-zinc-600">{item.description}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border-zinc-200/80 bg-white">
          <CardHeader className=" mb-0!">
            <CardTitle className="text-base tracking-tight text-zinc-900">Pagination and filtering conventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-zinc-600  ">
            <p>
              Collection endpoints support standard query parameters such as
              `page`, `per_page`, `search`, and status-specific filters.
            </p>
            <p>
              Paginated responses return a `meta` object including page,
              per-page, total, and total pages.
            </p>
            <pre className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 text-[12px] text-zinc-100 [font-family:var(--font-docs-mono)]">
              <code>{`GET /api/v1/shipments?page=1&per_page=20&search=ORD-8842`}</code>
            </pre>
          </CardContent>
        </Card>

        <Card className="border-zinc-200/80 bg-white">
          <CardHeader className="">
            <CardTitle className="text-base tracking-tight text-zinc-900">Standard request headers</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto rounded-lg border border-zinc-800/80 bg-zinc-950 p-3 text-[12px] text-zinc-100 [font-family:var(--font-docs-mono)]">
              <code>{`Authorization: Bearer <token>
Content-Type: application/json
Accept: application/json`}</code>
            </pre>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
