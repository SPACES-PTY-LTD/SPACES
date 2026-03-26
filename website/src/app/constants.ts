import {
  Activity,
  Building2,
  Cable,
  Code2,
  Compass,
  FileCheck2,
  Gauge,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Package,
  Route,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Warehouse,
  Waves,
} from "lucide-react"

export const NAV_ITEMS = [
  {
    label: "Platform",
    href: "#platform",
    items: [
      {
        icon: Layers,
        title: "Unified Command Center",
        description: "Dispatch, tracking, routing, and analytics in one surface.",
      },
      {
        icon: ShieldCheck,
        title: "Enterprise Security",
        description: "Role-based controls, audit logs, and isolated tenants.",
      },
    ],
  },
  {
    label: "Products",
    href: "#products",
    items: [
      {
        icon: Route,
        title: "Route Optimization",
        description: "Optimization logic for higher delivery density and lower miles.",
      },
      {
        icon: Activity,
        title: "Live Operations",
        description: "Real-time fleet telemetry and delivery state transitions.",
      },
    ],
  },
  {
    label: "Solutions",
    href: "#workflow",
    items: [
      {
        icon: Gauge,
        title: "Dispatch Automation",
        description: "Auto-assign drivers and sequence stops based on constraints.",
      },
      {
        icon: Compass,
        title: "Global Rollouts",
        description: "Deploy by region while keeping one operational model.",
      },
    ],
  },
  {
    label: "Industries",
    href: "#industries",
    items: [
      {
        icon: Store,
        title: "Retail & Commerce",
        description: "High-volume same-day and scheduled fulfillment operations.",
      },
      {
        icon: Warehouse,
        title: "3PL & Courier",
        description: "Multi-client execution with shared fleet visibility.",
      },
    ],
  },
  {
    label: "Resources",
    href: "/docs",
    items: [
      {
        icon: Code2,
        title: "Developer Docs",
        description: "REST APIs, webhook events, and integration quick starts.",
      },
      {
        icon: Cable,
        title: "Integration Guides",
        description: "Patterns for ERP, storefront, and carrier connectivity.",
      },
    ],
  },
  {
    label: "Pricing",
    href: "#pricing",
    items: [
      {
        icon: Truck,
        title: "Per-Vehicle Pricing",
        description: "Predictable pricing as your fleet scales by active vehicle.",
      },
      {
        icon: Building2,
        title: "200+ Vehicle Plans",
        description: "Custom enterprise packages with dedicated implementation.",
      },
    ],
  },
]

export const PAINS = [
  "Disconnected tools",
  "No live visibility",
  "Manual dispatch errors",
  "Inefficient routing",
  "Rising operational costs",
]

export const ARCHITECTURE_NODES = [
  "Orders",
  "Dispatch",
  "Route Optimization",
  "Driver App",
  "Delivery Confirmation",
  "Analytics",
]

export const OUTCOMES = [
  {
    icon: Route,
    title: "Deliver Faster",
    description: "Smart dispatching, dynamic routing, and automated ETAs.",
  },
  {
    icon: Waves,
    title: "Run Leaner",
    description: "Fuel optimization and driver utilization metrics across every lane.",
  },
  {
    icon: Globe,
    title: "See Everything",
    description: "Live tracking and event streaming for full operational visibility.",
  },
  {
    icon: Gauge,
    title: "Optimize Performance",
    description: "Heatmaps and historical dashboards for continuous improvement.",
  },
]

export const INDUSTRIES = [
  { icon: ShoppingBag, label: "Retail & E-Commerce", href: "/industries/retail" },
  { icon: Package, label: "Grocery Delivery", href: "/industries/grocery" },
  { icon: Warehouse, label: "3PL Providers", href: "/industries/3pl" },
  { icon: Truck, label: "Courier Services", href: "/industries/courier" },
  { icon: Compass, label: "Field Services", href: "/industries/field-services" },
  { icon: Building2, label: "Enterprise Fleets", href: "/industries/enterprise" },
]

export const SECURITY_ITEMS = [
  { icon: KeyRound, label: "Role-based permissions" },
  { icon: FileCheck2, label: "Audit logs" },
  { icon: Lock, label: "Data encryption" },
  { icon: ShieldCheck, label: "GDPR readiness" },
  { icon: Activity, label: "99.99% uptime" },
]