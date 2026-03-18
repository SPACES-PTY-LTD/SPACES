import Link from "next/link"
import { Menu } from "lucide-react"
import { DocsSidebar } from "@/components/docs/docs-sidebar"
import { DocsSearch } from "@/components/docs/docs-search"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { API_BASE_URL } from "@/lib/docs/api-reference"

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50/60 [--font-docs-sans:Inter,ui-sans-serif,system-ui,sans-serif] [--font-docs-mono:'SFMono-Regular',Menlo,Monaco,Consolas,'Liberation_Mono','Courier_New',monospace] [font-family:var(--font-docs-sans)]">
      <div className="mx-auto grid max-w-[1380px] md:grid-cols-[280px_minmax(0,1fr)]">
        <div className="hidden border-r border-zinc-200/80 md:block">
          <DocsSidebar />
        </div>

        <div className="min-h-screen">
          <header className="sticky top-0 z-20 border-b border-zinc-200/80 bg-white/90 px-5 py-3 backdrop-blur md:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Sheet>
                  <SheetTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 border-zinc-200 text-zinc-700 md:hidden"
                      aria-label="Open docs navigation"
                    >
                      <Menu className="h-4 w-4" />
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="left" className="w-[86vw] max-w-[320px] bg-zinc-50 p-0">
                    <SheetHeader className="sr-only">
                      <SheetTitle>Documentation navigation</SheetTitle>
                      <SheetDescription>Browse documentation sections and API endpoints.</SheetDescription>
                    </SheetHeader>
                    <DocsSidebar className="static h-full px-3 py-4" closeOnNavigate />
                  </SheetContent>
                </Sheet>
                <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-900">
                  Back to site
                </Link>
                <span className="text-sm font-semibold text-zinc-900">API Documentation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:block">
                  <DocsSearch />
                </div>
                <span className="hidden rounded-md border border-zinc-200 bg-zinc-100 px-2 py-1 text-xs text-zinc-700 [font-family:var(--font-docs-mono)] lg:inline-flex">
                  {API_BASE_URL}
                </span>
              </div>
            </div>
          </header>
          <main className="px-5 py-8 md:px-8">
            <div className="max-w-[1040px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  )
}
