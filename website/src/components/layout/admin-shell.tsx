"use client"

import * as React from "react"
import { AdminLinks } from "@/lib/routes/admin"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { usePathname, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { AdminNav } from "@/components/layout/admin-nav"
import { LogoutButton } from "@/components/auth/logout-button"
import { Toaster } from "@/components/ui/sonner"
import type { Session } from "@/lib/auth"
import { isMerchantSetupComplete } from "@/lib/merchant-setup"
import { ChevronDown, EllipsisVertical, Settings, Truck } from "lucide-react"
import { CreateMerchantDialog } from "@/components/merchants/create-merchant-dialog"
import { Button } from "../ui/button"

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pick n Drop"

export function AdminShell({
  session,
  children,
}: {
  session: Session
  children: React.ReactNode
}) {
  const { data: liveSession, update } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const activeSession = (liveSession as Session) ?? session
  const merchants = activeSession.merchants ?? []
  const selectedMerchant = activeSession.selected_merchant ?? merchants[0]
  const canManageMerchantUsers =
    activeSession.user.role === "super_admin" ||
    Boolean(activeSession.selected_merchant?.access?.permissions.can_manage_users)

  React.useEffect(() => {
    if (activeSession.user?.role !== "user") return
    if (!selectedMerchant?.merchant_id) return

    const completed = isMerchantSetupComplete(selectedMerchant)

    console.log(`Merchant setup completed!!!: ${completed}`,selectedMerchant)

    if (!completed && pathname !== AdminLinks.setup) {
      router.replace(AdminLinks.setup)
      return
    }

    if (completed && pathname === AdminLinks.setup) {
      router.replace(AdminLinks.dashboard)
    }
  }, [activeSession.user?.role, pathname, router, selectedMerchant])

  return (
    <SidebarProvider defaultOpen className="">
      <Sidebar variant="inset">
        <SidebarHeader className="gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Truck className="h-4 w-4" />
              </div>
              {appName}
            </div>
          </div>

          {activeSession.user?.role === "user" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="lg"
                  variant={"outline"}
                >
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-bold">
                      {selectedMerchant?.name ?? "Select merchant"}
                    </span>
                  </div>
                  <ChevronDown className="ml-auto size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {merchants.length ? (
                  merchants.map((merchant, index) => (
                    <DropdownMenuItem
                      key={merchant.merchant_id ?? merchant.name ?? index}
                      asChild
                    >
                      <button
                        className="w-full"
                        onClick={async () => {
                          const toastId = toast.loading("Switching merchant...")
                          try {
                            await update({
                              merchants,
                              selected_merchant: merchant,
                            })
                            router.refresh()
                            toast.success("Merchant changed successfully.", {
                              id: toastId,
                            })
                          } catch (err) {
                            toast.error(
                              "Failed to switch merchant." +
                                (err instanceof Error ? " " + err.message : ""),
                              {
                                id: toastId,
                              }
                            )
                          }
                        }}
                      >
                        <Avatar className="h-8 w-8 rounded-lg grayscale">
                          <AvatarFallback className="rounded-lg">
                            {(merchant.name ?? "").trim().charAt(0) || "M"}
                          </AvatarFallback>
                        </Avatar>
                        {merchant.name ?? "Merchant"}
                      </button>
                    </DropdownMenuItem>
                  ))
                ) : (
                  <DropdownMenuItem disabled>
                    No merchants available
                  </DropdownMenuItem>
                )}
                <CreateMerchantDialog />
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </SidebarHeader>
        <SidebarSeparator className="w-auto!" />
        <SidebarContent>
          <AdminNav
            role={activeSession.user.role}
            canManageMerchantUsers={canManageMerchantUsers}
          />
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton
                    size="lg"
                    className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                  >
                    <Avatar className="h-8 w-8 rounded-lg grayscale">
                      <AvatarImage src={""} alt={activeSession.user.name} />
                      <AvatarFallback className="rounded-lg">CN</AvatarFallback>
                    </Avatar>
                    <div className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-medium">
                        {activeSession.user.name}
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {activeSession.user.email}
                      </span>
                    </div>
                    <EllipsisVertical className="ml-auto size-4" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    Signed in as
                  </DropdownMenuLabel>
                  <DropdownMenuItem className="text-sm">
                    {activeSession.user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href={AdminLinks.settings}>
                      <Settings className="mr-2 h-4 w-4" />
                      Settings
                    </Link>
                  </DropdownMenuItem>
                  <LogoutButton />
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset className="bg-background">
        <header className="flex items-center gap-2 border-b px-4 py-3 md:hidden">
          <SidebarTrigger />
          <span className="text-sm font-semibold">{appName}</span>
        </header>
        <main className="min-h-[calc(100vh-4rem)] flex-1 overflow-hidden px-6 py-6">
          {children}
        </main>
      </SidebarInset>
      <Toaster richColors position="top-right" />
    </SidebarProvider>
  )
}
