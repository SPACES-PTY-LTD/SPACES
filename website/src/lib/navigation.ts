import { AdminLinks } from "@/lib/routes/admin"
import {
  Activity,
  Boxes,
  CalendarClock,
  ClipboardCheck,
  CreditCard,
  Globe,
  MapPin,
  Map,
  PackageOpen,
  Plug,
  ShieldCheck,
  Truck,
  Users,
  Waypoints,
  Compass,
  FileUser,
  CogIcon,
  Blocks,
  Home,
  ChartArea,
  ChartNoAxesColumn,
  Trash2,
  FileText,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { Role } from "@/lib/types"

export type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  roles?: Role[]
  subItems?: NavItem[]
}

export type NavGroup = {
  id: string
  title: string
  items: NavItem[]
}

export const adminNavGroups: NavGroup[] = [
  
  
  {
    id: "logistics",
    title: "",
    items: [
      {
        title: "Dashboard",
        href: AdminLinks.dashboard,
        icon: Home,
      },
      {
        title: "Shipments",
        href: AdminLinks.shipments,
        icon: CreditCard,
        subItems: [
          // {
          //   title: "Quotes",
          //   href: AdminLinks.quotes,
          //   icon: CreditCard,
          // },

          {
            title: "Shipments Report",
            href: AdminLinks.reportsShipments,
            icon: ClipboardCheck,
          },
          {
            title: "Bookings",
            href: AdminLinks.bookings,
            icon: CalendarClock,
          },
          {
            title: "Tracking",
            href: AdminLinks.tracking,
            icon: Compass,
          },
          {
            title: "Invoiced",
            href: AdminLinks.invoiced,
            icon: CreditCard,
          }
        ]
      },
      {
        title: "Locations",
        href: AdminLinks.locations,
        icon: MapPin,
        subItems: [
          {
            title: "Activity",
            href: AdminLinks.locations + "/activity",
            icon: Activity,
          },
        ]
      },
      {
        title: "Routes",
        href: AdminLinks.routes,
        icon: Waypoints,
      },
      {
        title: "Drivers",
        href: AdminLinks.drivers,
        icon: FileUser
      },
      {
        title: "Vehicles",
        href: AdminLinks.vehicles,
        icon: Truck,
        roles: ["user"],
        subItems: [
          {
            title: "Activities",
            href: AdminLinks.vehicleActivities,
            icon: Activity,
          },
          {
            title: "Map",
            href: AdminLinks.vehiclesMap,
            icon: Map,
          },
        ]
      },
      {
        title: "Analytics",
        href: AdminLinks.logistics_analytics,
        icon: ChartNoAxesColumn,
        subItems: [
          {
            title: "Route Waiting Times",
            href: AdminLinks.analyticsRouteWaitingTimes,
            icon: ChartArea,
          },
          {
            title: "Stops Analysis",
            href: AdminLinks.analyticsStopsAnalysis,
            icon: ChartArea,
          },
          {
            title: "Drivers Speeding",
            href: AdminLinks.analyticsDriversSpeeding,
            icon: ChartArea,
          },
          {
            title: "Missing Documents",
            href: AdminLinks.analyticsMissingDocuments,
            icon: FileText,
          },
          {
            title: "Expired / Expiring Documents",
            href: AdminLinks.analyticsDocumentExpiry,
            icon: FileText,
          },
          {
            title: "Upload Coverage by Type",
            href: AdminLinks.analyticsDocumentCoverage,
            icon: ChartArea,
          },
        ]
      }

    ],
  },

  // {
  //   id: "sales",
  //   title: "Sales",
  //   items: [
  //     {
  //       title: "Orders",
  //       href: AdminLinks.orders,
  //       icon: LayoutDashboard,
  //       subItems: [
  //         {
  //           title: "Drafts",
  //           href: AdminLinks.ordersDrafts,
  //           icon: LayoutDashboard,
  //         },
  //         {
  //           title: "Abandoned Checkouts",
  //           href: AdminLinks.ordersAbandonedCheckouts,
  //           icon: LayoutDashboard,
  //         },
  //       ]
  //     },
  //   ]
  // },
  // {
  //   id: "inventory",
  //   title: "Inventory",
  //   items: [

  //     {
  //       title: "Products",
  //       href: AdminLinks.products,
  //       icon: Boxes,
  //       subItems: [
  //         // Collections, Inventory, Purchase orders, Transfers, Gift cards
  //         {
  //           title: "Collections",
  //           href: AdminLinks.productsCollections,
  //           icon: LayoutDashboard,
  //         },
  //         {
  //           title: "Inventory",
  //           href: AdminLinks.productsInventory,
  //           icon: LayoutDashboard,
  //         },
  //         {
  //           title: "Purchase Orders",
  //           href: AdminLinks.productsPurchaseOrders,
  //           icon: LayoutDashboard,
  //         },
  //         {
  //           title: "Transfers",
  //           href: AdminLinks.productsTransfers,
  //           icon: LayoutDashboard,
  //         }
  //       ]
  //     },
  //     {
  //       title: "Warehouses",
  //       href: AdminLinks.warehouses,
  //       icon: Building,
  //     },
  //   ]
  // },

  {
    id: "admin_tools",
    title: "Admin Tools",
    items: [
      {
        title: "Users",
        href: AdminLinks.users,
        icon: ShieldCheck,
        roles: ["super_admin"],
      },
      {
        title: "Vehicle Types",
        href: AdminLinks.vehicleTypes,
        icon: Boxes,
        roles: ["super_admin"],
      },
      {
        title: "Cancel Reasons",
        href: AdminLinks.cancelReasons,
        icon: ClipboardCheck,
        roles: ["super_admin"],
      },
      {
        title: "Drivers",
        href: AdminLinks.drivers,
        icon: Waypoints,
        roles: ["super_admin"],
      }
    ],
  },
  
  {
    id: "settings",
    title: "",
    items: [
      {
        title: "Settings",
        href: AdminLinks.settings,
        icon: CogIcon,
        subItems: [
          {
            title: "Genral",
            href: AdminLinks.settings,
            icon: CogIcon,
            roles: ["super_admin"],
          },
          {
            title: "Merchants",
            href: AdminLinks.merchants,
            icon: Users,
            roles: ["super_admin"],
          },
          {
            title: "Integrations",
            href: AdminLinks.settingsIntegrations,
            icon: Plug,
            roles: ["user"],
          },
          {
            title: "Location Types",
            href: AdminLinks.settingsLocationTypes,
            icon: MapPin,
            roles: ["user"],
          },
          {
            title: "Location Automation",
            href: AdminLinks.settingsLocationAutomation,
            icon: Waypoints,
            roles: ["user"],
          },
          {
            title: "File Types",
            href: AdminLinks.settingsFileTypes,
            icon: FileText,
            roles: ["user"],
          },
          {
            title: "Carriers",
            href: AdminLinks.carriers,
            icon: PackageOpen,
            roles: ["user", "super_admin"],
          },
          {
            title: "Environments",
            href: AdminLinks.settingsEnvironments,
            icon: Globe,
            roles: ["user"],
          },
          {
            title: "Delete Data",
            href: AdminLinks.settingsDeleteData,
            icon: Trash2,
            roles: ["user"],
          },
          // {
          //   title: "Merchants",
          //   href: AdminLinks.merchants,
          //   icon: Users,
          //   roles: ["user"],
          // },
          // users
          {
            title: "Users",
            href: AdminLinks.users,
            icon: ShieldCheck,
            roles: ["user"],
          },
          {
            title: "Webhooks",
            href: AdminLinks.webhookSubscriptions,
            icon: Plug,
          },
          {
            title: "Deliveries",
            href: AdminLinks.webhookDeliveries,
            icon: Activity,
            roles: ["super_admin"],
          },
          {
            title: "Activity log",
            href: AdminLinks.activityLog,
            icon: Activity,
          },
        ]
      },

      // Intergrations

    ],
  },

  // {
  //   id: "apps",
  //   title: "Apps",
  //   items: [
  //     {
  //       title: "Active Apps",
  //       href: AdminLinks.apps,
  //       icon: Blocks,
  //       roles: ["user"],
  //     },
  //   ],
  // },
  
]

function filterNavItemsByRole(items: NavItem[], role: Role): NavItem[] {
  const filtered: NavItem[] = []

  for (const item of items) {
    const subItems = item.subItems
      ? filterNavItemsByRole(item.subItems, role)
      : undefined
    const hasItemAccess = !item.roles || item.roles.includes(role)
    if (!hasItemAccess && (!subItems || subItems.length === 0)) {
      continue
    }
    filtered.push({
      ...item,
      subItems,
    })
  }

  return filtered
}

export function filterNavByRole(groups: NavGroup[], role: Role) {
  return groups
    .map((group) => ({
      ...group,
      items: filterNavItemsByRole(group.items, role),
    }))
    .filter((group) => group.items.length > 0)
}
