import type { Metadata } from "next"
import Link from "next/link"
import {
  Activity,
  ArrowRight,
  Building2,
  Cable,
  ChevronDown,
  Code2,
  Compass,
  FileCheck2,
  Gauge,
  Globe,
  KeyRound,
  Layers,
  Lock,
  Menu,
  Package,
  Route,
  ShieldCheck,
  ShoppingBag,
  Store,
  Truck,
  Warehouse,
  Waves,
} from "lucide-react"
import { MetricsCounters } from "@/components/home/metrics-counters"
import styles from "./homepage.module.css"

export const metadata: Metadata = {
  title: "Global Logistics Platform | Dispatch, Routing, Tracking, APIs",
  description:
    "Enterprise logistics SaaS for dispatch, route optimization, live tracking, analytics, APIs, and webhooks.",
}

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pick n Drop"

const navItems = [
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

const pains = [
  "Disconnected tools",
  "No live visibility",
  "Manual dispatch errors",
  "Inefficient routing",
  "Rising operational costs",
]

const architectureNodes = [
  "Orders",
  "Dispatch",
  "Route Optimization",
  "Driver App",
  "Delivery Confirmation",
  "Analytics",
]

const outcomes = [
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

const workflowSteps = [
  "Import Orders",
  "Auto Assign Drivers",
  "Optimize Routes",
  "Monitor in Real-Time",
  "Analyze Performance",
]

const industries = [
  { icon: ShoppingBag, label: "Retail & E-Commerce", href: "/industries/retail" },
  { icon: Package, label: "Grocery Delivery", href: "/industries/grocery" },
  { icon: Warehouse, label: "3PL Providers", href: "/industries/3pl" },
  { icon: Truck, label: "Courier Services", href: "/industries/courier" },
  { icon: Compass, label: "Field Services", href: "/industries/field-services" },
  { icon: Building2, label: "Enterprise Fleets", href: "/industries/enterprise" },
]

const securityItems = [
  { icon: KeyRound, label: "Role-based permissions" },
  { icon: FileCheck2, label: "Audit logs" },
  { icon: Lock, label: "Data encryption" },
  { icon: ShieldCheck, label: "GDPR readiness" },
  { icon: Activity, label: "99.99% uptime" },
]

const roiMetrics = [
  { label: "Faster Deliveries", value: 30, suffix: "%" },
  { label: "Lower Fuel Costs", value: 25, suffix: "%" },
  { label: "Reduced Idle Time", value: 20, suffix: "%" },
  { label: "Availability", value: 99.99, suffix: "%" },
]

const testimonials = [
  {
    company: "Northbound Retail Group",
    quote:
      "We replaced three disconnected systems and gained real-time control across 18 regions in under six weeks.",
    person: "Amina D.",
    role: "VP Logistics",
  },
  {
    company: "TransAxis 3PL",
    quote:
      "Dispatch decisions are now data-backed. Route density increased while service-level consistency improved every month.",
    person: "David M.",
    role: "Head of Operations",
  },
  {
    company: "MetroFleet Courier",
    quote:
      "Webhook-driven status sync removed manual reconciliation and gave our clients transparent delivery timelines.",
    person: "Sara K.",
    role: "Chief Product Officer",
  },
]

const footerGroups = [
  {
    heading: "Products",
    links: ["Dispatch", "Route Optimization", "Tracking", "Analytics", "APIs"],
  },
  {
    heading: "Solutions",
    links: ["Retail", "Grocery", "3PL", "Courier", "Enterprise"],
  },
  {
    heading: "Resources",
    links: ["Blog", "Case Studies", "Documentation", "API Reference"],
  },
  {
    heading: "Company",
    links: ["About", "Careers", "Press", "Contact"],
  },
  {
    heading: "Legal",
    links: ["Terms", "Privacy", "Security", "Compliance"],
  },
]

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.backgroundLayer} />

      <header className={styles.headerWrap}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.brand} aria-label={`${appName} home`}>
            <span className={styles.brandMark} aria-hidden>
              <Truck size={16} />
            </span>
            <span>{appName}</span>
          </Link>

          <nav className={styles.desktopNav} aria-label="Primary navigation">
            {navItems.map((item) => (
              <div key={item.label} className={styles.navItem}>
                <Link href={item.href} className={styles.navTrigger}>
                  {item.label}
                  <ChevronDown size={14} />
                </Link>
                <div className={styles.dropdown}>
                  {item.items.map((entry) => {
                    const Icon = entry.icon
                    return (
                      <div key={entry.title} className={styles.dropdownEntry}>
                        <span className={styles.dropdownIcon}>
                          <Icon size={16} />
                        </span>
                        <span>
                          <strong>{entry.title}</strong>
                          <small>{entry.description}</small>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </nav>

          <details className={styles.mobileMenu}>
            <summary className={styles.mobileMenuTrigger} aria-label="Open navigation menu">
              <Menu size={18} />
              Menu
            </summary>
            <div className={styles.mobileMenuPanel}>
              <nav className={styles.mobileNavLinks} aria-label="Mobile navigation">
                {navItems.map((item) => (
                  <details key={item.label} className={styles.mobileNavGroup}>
                    <summary className={styles.mobileNavGroupTrigger}>
                      <span>{item.label}</span>
                      <ChevronDown size={14} />
                    </summary>
                    <div className={styles.mobileNavGroupContent}>
                      <Link href={item.href} className={styles.mobileNavSectionLink}>
                        Go to {item.label}
                      </Link>
                      {item.items.map((entry) => {
                        const Icon = entry.icon
                        return (
                          <div key={entry.title} className={styles.mobileDropdownEntry}>
                            <span className={styles.dropdownIcon}>
                              <Icon size={16} />
                            </span>
                            <span>
                              <strong>{entry.title}</strong>
                              <small>{entry.description}</small>
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </details>
                ))}
              </nav>
              <div className={styles.mobileMenuActions}>
                <Link href="#contact" className={styles.mobileActionLink}>
                  Contact Sales
                </Link>
                <Link href="/auth/login" className={styles.mobileActionLink}>
                  Login
                </Link>
                <Link href="#contact" className={styles.primaryBtn}>
                  Start Free Trial
                </Link>
              </div>
            </div>
          </details>

          <div className={styles.headerActions}>
            <Link href="#contact" className={styles.textLink}>
              Contact Sales
            </Link>
            <Link href="/auth/login" className={styles.textLink}>
              Login
            </Link>
            <Link href="#contact" className={styles.primaryBtn}>
              Start Free Trial
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.heroSection}>
          <div className={styles.heroCopy}>
            <p className={styles.kicker}>Global Logistics Platform</p>
            <h1>Control Every Delivery From Order to Doorstep.</h1>
            <p className={styles.heroText}>
              One unified logistics platform for dispatch, routing, tracking,
              analytics, and real-time fleet operations.
            </p>
            <div className={styles.heroActions}>
              <Link href="#contact" className={styles.primaryBtn}>
                Start Free Trial
              </Link>
              <Link href="#contact" className={styles.secondaryBtn}>
                Book a Demo
              </Link>
              <Link href="/docs" className={styles.docsLink}>
                View API Docs <ArrowRight size={14} />
              </Link>
            </div>
            <div className={styles.heroChecks}>
              <span>Go live in days</span>
              <span>Per-vehicle pricing</span>
              <span>Enterprise-grade security</span>
            </div>
          </div>

          <div className={styles.mapPanel}>
            <div className={styles.mapFrame}>
              <div className={styles.mapStatusRow}>
                <span>Live Network</span>
                <span>14 active vehicles</span>
              </div>
              <div className={styles.mapCanvas}>
                <div className={styles.mapRoads} />
                <div className={styles.routeOne} />
                <div className={styles.routeTwo} />
                <div className={styles.routeThree} />
                {Array.from({ length: 12 }).map((_, i) => (
                  <span
                    key={`vehicle-${i}`}
                    className={styles.vehicle}
                    style={{
                      animationDelay: `${i * 0.42}s`,
                      top: `${12 + (i % 6) * 13}%`,
                      left: `${8 + (i % 5) * 17}%`,
                    }}
                  />
                ))}
                <div className={styles.markerDelivered}>Delivered</div>
                <div className={styles.markerTransit}>In Transit</div>
                <div className={styles.markerDelayed}>Delayed</div>
                <div className={styles.etaCardA}>ETA 12:18</div>
                <div className={styles.etaCardB}>ETA 12:31</div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.painSection}>
          <h2>Logistics Shouldn&apos;t Be Chaos.</h2>
          <div className={styles.painGrid}>
            {pains.map((pain) => (
              <div key={pain} className={styles.painCard}>
                {pain}
              </div>
            ))}
          </div>
          <p className={styles.solutionLine}>
            Replace fragmentation with one unified command center.
          </p>
        </section>

        <section id="platform" className={styles.archSection}>
          <h2>A Unified Logistics Engine</h2>
          <div className={styles.archFlow}>
            {architectureNodes.map((node, index) => (
              <div key={node} className={styles.archNodeWrap}>
                <div className={styles.archNode}>{node}</div>
                {index < architectureNodes.length - 1 ? (
                  <span className={styles.archArrow} aria-hidden>
                    <span className={styles.pulseDot} />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="products" className={styles.outcomesSection}>
          <h2>Outcomes That Move the Metrics</h2>
          <div className={styles.outcomesGrid}>
            {outcomes.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className={styles.outcomeCard}>
                  <span className={styles.outcomeIcon}>
                    <Icon size={20} />
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.description}</p>
                </article>
              )
            })}
          </div>
        </section>

        <section id="workflow" className={styles.workflowSection}>
          <div>
            <h2>Operational Workflow, End to End</h2>
            <ol className={styles.workflowList}>
              {workflowSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
          <div className={styles.workflowPreview}>
            <div className={`${styles.previewLayer} ${styles.previewLayerOne}`}>
              Route Planner
            </div>
            <div className={`${styles.previewLayer} ${styles.previewLayerTwo}`}>
              Live Map Dashboard
            </div>
            <div className={`${styles.previewLayer} ${styles.previewLayerThree}`}>
              Driver App Screen
            </div>
            <div className={`${styles.previewLayer} ${styles.previewLayerFour}`}>
              Analytics Dashboard
            </div>
          </div>
        </section>

        <section id="industries" className={styles.industriesSection}>
          <h2>Built for Every Logistics Operation</h2>
          <div className={styles.industriesGrid}>
            {industries.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.label} href={item.href} className={styles.industryCard}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className={styles.apiSection}>
          <div>
            <h2>Built API-First. Powered by Webhooks.</h2>
            <ul className={styles.apiList}>
              <li>REST APIs</li>
              <li>Webhooks</li>
              <li>SDKs</li>
              <li>Event streaming</li>
            </ul>
          </div>
          <div className={styles.codePanel}>
            <div className={styles.codeTitle}>Webhook Payload</div>
            <pre>
{`{
  "delivery_id": "DLV-12345",
  "status": "IN_TRANSIT",
  "timestamp": "2026-02-19T14:10:00Z"
}`}
            </pre>
          </div>
        </section>

        <section className={styles.securitySection}>
          <h2>Built for Trust</h2>
          <div className={styles.securityGrid}>
            {securityItems.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.label} className={styles.securityCard}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </article>
              )
            })}
          </div>
        </section>

        <section className={styles.roiSection}>
          <h2>Operational ROI</h2>
          <MetricsCounters metrics={roiMetrics} />
        </section>

        <section id="pricing" className={styles.pricingStrip}>
          <div>
            <h3>Simple, Transparent Pricing</h3>
            <ul className={styles.pricingList}>
              <li>Per vehicle pricing</li>
              <li>Volume discounts above 200 vehicles</li>
              <li>No hidden fees</li>
            </ul>
          </div>
          <Link href="#contact" className={styles.secondaryBtn}>
            View Pricing
          </Link>
        </section>

        <section className={styles.testimonialsSection}>
          <h2>Trusted by Logistics Leaders</h2>
          <div className={styles.testimonialGrid}>
            {testimonials.map((item) => (
              <article key={item.company} className={styles.testimonialCard}>
                <p className={styles.company}>{item.company}</p>
                <blockquote>{item.quote}</blockquote>
                <p className={styles.person}>
                  {item.person} <span>{item.role}</span>
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="contact" className={styles.contactSection}>
          <h2>Ready to Take Control of Your Fleet?</h2>
          <p>
            Launch quickly with implementation support, API integration guidance,
            and a rollout plan aligned to your operational model.
          </p>
          <div className={styles.contactActions}>
            <Link href="#" className={styles.primaryBtn}>
              Start Free Trial
            </Link>
            <Link href="#" className={styles.secondaryBtn}>
              Contact Sales
            </Link>
            <Link href="/docs" className={styles.docsLink}>
              View API Docs <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          {footerGroups.map((group) => (
            <section key={group.heading}>
              <h3>{group.heading}</h3>
              <ul>
                {group.links.map((link) => (
                  <li key={link}>
                    <Link href="#">{link}</Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <p className={styles.footerMeta}>© 2026 {appName}. All rights reserved.</p>
      </footer>
    </div>
  )
}
