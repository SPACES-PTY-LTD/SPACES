"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { FileText, Hash, Search } from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { apiReferenceCategories } from "@/lib/docs/api-reference"

type SearchEntry = {
  id: string
  title: string
  section: string
  href: string
  keywords: string
}

export function DocsSearch() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  const entries = useMemo<SearchEntry[]>(() => {
    const baseEntries: SearchEntry[] = [
      {
        id: "docs-intro",
        title: "Introduction",
        section: "Docs",
        href: "/docs",
        keywords: "overview getting started base url authentication rate limits pagination",
      },
      {
        id: "docs-api-ref",
        title: "API Reference",
        section: "Docs",
        href: "/docs/api-reference",
        keywords: "endpoints categories reference",
      },
    ]

    const endpointEntries = apiReferenceCategories.flatMap((category) =>
      category.endpoints.map((endpoint) => ({
        id: `${category.slug}-${endpoint.slug}`,
        title: endpoint.title,
        section: category.title,
        href: `/docs/api-reference/${category.slug}/${endpoint.slug}`,
        keywords: `${endpoint.title} ${endpoint.path} ${endpoint.method} ${endpoint.summary} ${endpoint.description}`.toLowerCase(),
      }))
    )

    return [...baseEntries, ...endpointEntries]
  }, [])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()
      if ((event.metaKey || event.ctrlKey) && key === "k") {
        event.preventDefault()
        setOpen((value) => !value)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  const onSelect = (href: string) => {
    setOpen(false)
    router.push(href)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs items-center justify-between rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-500 transition hover:bg-zinc-100"
      >
        <span className="inline-flex items-center gap-2">
          <Search className="h-3.5 w-3.5" />
          Search docs...
        </span>
        <kbd className="rounded border border-zinc-200 bg-white px-1.5 py-0.5 text-[10px] text-zinc-500">
          {"\u2318"}K
        </kbd>
      </button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search documentation"
        description="Search categories and endpoints"
      >
        <CommandInput placeholder="Search docs or endpoint path..." />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Documentation">
            {entries
              .filter((entry) => entry.section === "Docs")
              .map((entry) => (
                <CommandItem key={entry.id} value={`${entry.title} ${entry.keywords}`} onSelect={() => onSelect(entry.href)}>
                  <FileText className="h-4 w-4" />
                  <span>{entry.title}</span>
                </CommandItem>
              ))}
          </CommandGroup>

          <CommandSeparator />

          <CommandGroup heading="Endpoints">
            {entries
              .filter((entry) => entry.section !== "Docs")
              .map((entry) => (
                <CommandItem key={entry.id} value={`${entry.title} ${entry.section} ${entry.keywords}`} onSelect={() => onSelect(entry.href)}>
                  <Hash className="h-4 w-4" />
                  <span>{entry.title}</span>
                  <CommandShortcut>{entry.section}</CommandShortcut>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
