"use client"

import { AdminLinks } from "@/lib/routes/admin"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { adminNavGroups, filterNavByRole } from "@/lib/navigation"
import type { Role } from "@/lib/types"

export function AdminNav({
  role,
  canManageMerchantUsers = false,
}: {
  role: Role
  canManageMerchantUsers?: boolean
}) {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const groups = filterNavByRole(adminNavGroups, role).map((group) => ({
    ...group,
    items: group.items
      .map((item) => ({
        ...item,
        subItems: item.subItems?.filter(
          (subItem) =>
            subItem.href !== AdminLinks.users || role === "super_admin" || canManageMerchantUsers
        ),
      }))
      .filter((item) => item.href !== AdminLinks.users || role === "super_admin" || canManageMerchantUsers),
  })).filter((group) => group.items.length > 0)

  const isPathActive = (href: string) => {
    if (href === AdminLinks.dashboard) {
      return pathname === href
    }
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  const shouldShowSubItems = (href: string) => pathname.startsWith(`${href}`)

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <>
      {groups.map((group) => (
        <SidebarGroup key={group.id}>
          {group.title && (
          <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
          )}

          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => {
                const Icon = item.icon
                const active =
                  isPathActive(item.href) ||
                  (item.subItems?.some((subItem) => isPathActive(subItem.href)) ??
                    false)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={active}>
                      <Link href={item.href} onClick={handleNavClick}>
                        <Icon className="size-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                    {item.subItems?.length && shouldShowSubItems(item.href) ? (
                      <SidebarMenuSub>
                        {item.subItems.map((subItem) => {
                          const subActive = isPathActive(subItem.href)

                          return (
                            <SidebarMenuSubItem key={subItem.href}>
                              <SidebarMenuSubButton asChild isActive={subActive}>
                                <Link href={subItem.href} onClick={handleNavClick}>
                                  <span>{subItem.title}</span>
                                </Link>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    ) : null}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  )
}
