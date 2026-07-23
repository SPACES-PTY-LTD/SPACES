import Link from "next/link"
import { KeyRound, Network, Route } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AdminLinks } from "@/lib/routes/admin"

const tools = [
  {
    title: "Autorun Lifecycle Test",
    description: "Manually process a truck at a location and inspect the resulting lifecycle activity.",
    href: AdminLinks.autorunTest,
    icon: Route,
  },
  {
    title: "Powerfleet Authentication Check",
    description: "Inspect the saved Powerfleet authentication response, decoded token payload, and expiry timing.",
    href: AdminLinks.powerfleetAuthenticationCheck,
    icon: KeyRound,
  },
  {
    title: "Available Powerfleet Organizations",
    description: "Browse organizations, expand subgroups, and inspect group details for the selected merchant.",
    href: AdminLinks.powerfleetOrganizations,
    icon: Network,
  },
]

export default async function AdminToolsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Tools"
        description="Operational tools for checking integrations and troubleshooting merchant setup."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => {
          const Icon = tool.icon

          return (
            <Link key={tool.href} href={tool.href} className="block">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader className="flex-row items-start gap-4 space-y-0">
                  <div className="rounded-lg border bg-background p-2">
                    <Icon className="size-5" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <CardTitle className="text-base">{tool.title}</CardTitle>
                    <CardDescription>{tool.description}</CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
