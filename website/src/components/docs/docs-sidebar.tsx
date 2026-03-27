"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { apiReferenceCategories } from "@/lib/docs/api-reference"
import { ApiMethodBadge } from "@/components/docs/api-method-badge"
import { SheetClose } from "@/components/ui/sheet"

type DocsSidebarProps = {
  className?: string
  closeOnNavigate?: boolean
}

function DocsNavLink({
  href,
  className,
  children,
  closeOnNavigate,
}: {
  href: string
  className: string
  children: React.ReactNode
  closeOnNavigate: boolean
}) {
  if (closeOnNavigate) {
    return (
      <SheetClose asChild>
        <Link href={href} className={className}>
          {children}
        </Link>
      </SheetClose>
    )
  }

  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  )
}

export function DocsSidebar({ className, closeOnNavigate = false }: DocsSidebarProps) {
  const pathname = usePathname()

  return (
    <aside className={cn("sticky top-0 h-screen overflow-y-auto bg-transparent px-4 py-6", className)}>
      <DocsNavLink href="/docs" className="mb-6 block text-sm font-semibold text-zinc-900 tracking-tight" closeOnNavigate={closeOnNavigate}>
        Spaces Digital Docs
      </DocsNavLink>

      <nav className="space-y-6">
        <div className="space-y-1">
          <DocsNavLink
            href="/docs"
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
              pathname === "/docs" && "bg-zinc-900 text-zinc-50 hover:bg-zinc-900"
            )}
            closeOnNavigate={closeOnNavigate}
          >
            Introduction
          </DocsNavLink>
          <DocsNavLink
            href="/docs/api-reference"
            className={cn(
              "block rounded-md px-2 py-1.5 text-sm text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
              pathname === "/docs/api-reference" && "bg-zinc-900 text-zinc-50 hover:bg-zinc-900"
            )}
            closeOnNavigate={closeOnNavigate}
          >
            API Reference
          </DocsNavLink>
        </div>

        {apiReferenceCategories.map((category) => (
          <div key={category.slug} className="space-y-1.5">
            <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-400">
              {category.title}
            </p>
            <ul className="space-y-0.5">
              {category.endpoints.map((endpoint) => {
                const href = `/docs/api-reference/${category.slug}/${endpoint.slug}`
                const active = pathname === href

                return (
                  <li key={endpoint.slug}>
                    <DocsNavLink
                      href={href}
                      className={cn(
                        "flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900",
                        active && "bg-zinc-900 text-zinc-50 hover:bg-zinc-900 hover:text-zinc-50"
                      )}
                      closeOnNavigate={closeOnNavigate}
                    >
                      <span className="line-clamp-1">{endpoint.title}</span>
                      <ApiMethodBadge method={endpoint.method} />
                    </DocsNavLink>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  )
}
