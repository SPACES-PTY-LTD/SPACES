import type { CSSProperties } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  BadgeCheck,
  Clock3,
  MapPinned,
  Navigation,
  Route,
  Sparkles,
  Truck,
  Upload,
  Users,
} from "lucide-react"
import styles from "./homepage.module.css"

export const metadata: Metadata = {
  title: "Spaces Digital | Dispatch And Delivery Platform",
  description:
    "Plan smarter routes, track drivers live, and manage delivery operations from one platform.",
}

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Spaces Digital"

const navItems = ["Product", "Solutions", "Customers", "Resources"]

const trustedBy = ["SwiftCart", "UrbanSend", "ParcelLoop", "Northstar", "CargoFlow"]

const painPoints = [
  "Inefficient routing wastes driver hours and fuel every day.",
  "Teams lose visibility the moment orders leave the warehouse.",
  "Dispatchers juggle calls, spreadsheets, and status updates manually.",
]

const features = [
  {
    icon: Route,
    title: "Route Optimization",
    description:
      "Build balanced runs around time windows, traffic, and stop density in seconds.",
  },
  {
    icon: MapPinned,
    title: "Real-time Tracking",
    description:
      "See every active vehicle on one live map with status, ETA, and route progress.",
  },
  {
    icon: Users,
    title: "Driver Management",
    description:
      "Assign work clearly, monitor completion, and surface exceptions before they cascade.",
  },
  {
    icon: Clock3,
    title: "ETA Predictions",
    description:
      "Keep customers and dispatchers aligned with delivery windows that stay current.",
  },
  {
    icon: BadgeCheck,
    title: "Proof of Delivery",
    description:
      "Capture signatures, photos, and handoff confirmations directly from the field.",
  },
  {
    icon: BarChart3,
    title: "Analytics Dashboard",
    description:
      "Track route efficiency, on-time performance, and driver productivity from one view.",
  },
]

const showcaseItems = [
  {
    eyebrow: "Plan routes in seconds",
    title: "Turn a stop list into an optimized dispatch plan without spreadsheet work.",
    description:
      "Group stops intelligently, balance workloads, and publish clean routes from a single planner.",
    points: ["Driver stop list interface", "Capacity-aware assignments", "Drag-to-adjust route order"],
  },
  {
    eyebrow: "Track drivers live",
    title: "Give operations one current picture of the entire fleet.",
    description:
      "Monitor motion, delays, completed drops, and route deviations in real time without constant check-ins.",
    points: ["Map with moving driver icons", "Live delay alerts", "Route progress timeline"],
  },
  {
    eyebrow: "Keep customers informed",
    title: "Deliver better updates without adding more manual communication.",
    description:
      "Share accurate ETAs, delivery progress, and proof of delivery through a clean tracking experience.",
    points: ["Mobile delivery tracking screen", "Branded ETA updates", "Delivery completion confirmation"],
  },
]

const steps = [
  {
    icon: Upload,
    title: "Upload orders",
    description: "Import orders from commerce systems, internal tools, or CSV files.",
  },
  {
    icon: Sparkles,
    title: "Optimize routes",
    description: "Generate efficient runs based on zones, capacity, and service windows.",
  },
  {
    icon: Navigation,
    title: "Dispatch & track",
    description: "Push work to drivers, follow execution live, and resolve exceptions fast.",
  },
]

const metrics = [
  { value: "60+", label: "minutes saved per dispatcher each day" },
  { value: "30%", label: "lower delivery time across active routes" },
  { value: "18%", label: "higher fleet efficiency from balanced runs" },
]

const testimonials = [
  {
    name: "Amina Dube",
    role: "Operations Director",
    company: "SwiftCart",
    quote:
      "This platform transformed how we manage deliveries. Dispatch is faster, drivers have clearer routes, and customers trust our ETAs again.",
  },
  {
    name: "Daniel Moyo",
    role: "Head of Logistics",
    company: "ParcelLoop",
    quote:
      "We replaced manual planning with one live control surface. It gave the team immediate visibility across every active route.",
  },
  {
    name: "Lerato Khan",
    role: "COO",
    company: "UrbanSend",
    quote:
      "The product looks simple, but it handles the operational detail we need to scale without adding dispatch overhead.",
  },
]

const footerGroups = [
  {
    title: "Product",
    links: ["Route Planning", "Live Tracking", "Driver App", "Analytics"],
  },
  {
    title: "Company",
    links: ["About", "Customers", "Careers", "Contact"],
  },
  {
    title: "Resources",
    links: ["Documentation", "API", "Guides", "Status"],
  },
  {
    title: "Legal",
    links: ["Privacy", "Terms", "Security", "Compliance"],
  },
]

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div className={styles.sectionIntro}>
      <p className={styles.eyebrow}>{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <div className={styles.pageGlow} aria-hidden="true" />

      <header className={styles.header}>
        <div className={styles.container}>
          <div className={styles.headerRow}>
            <Link href="/" className={styles.brand} aria-label={`${appName} home`}>
              <span className={styles.brandMark}>
                <Truck size={16} />
              </span>
              <span>{appName}</span>
            </Link>

            <nav className={styles.nav} aria-label="Primary navigation">
              {navItems.map((item) => (
                <Link key={item} href="/" className={styles.navLink}>
                  {item}
                </Link>
              ))}
            </nav>

            <div className={styles.headerActions}>
              <Link href="/auth/login" className={styles.ghostButton}>
                Sign in
              </Link>
              <Link href="#cta" className={styles.primaryButton}>
                Book Demo
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.heroSection}>
          <div className={styles.container}>
            <div className={styles.heroGrid}>
              <div className={styles.heroCopy}>
                <p className={styles.eyebrow}>Delivery Operations Platform</p>
                <h1>Plan smarter routes. Deliver faster. Scale your operations.</h1>
                <p className={styles.heroText}>
                  Optimize delivery routes, track drivers in real-time, and manage
                  dispatch from a single platform built for modern logistics teams.
                </p>
                <div className={styles.heroActions}>
                  <Link href="#cta" className={styles.primaryButton}>
                    Start Free Trial
                  </Link>
                  <Link href="#cta" className={styles.secondaryButton}>
                    Book Demo
                  </Link>
                </div>
                <div className={styles.heroMeta}>
                  <span>Live tracking</span>
                  <span>Route planning</span>
                  <span>Delivery management</span>
                </div>
              </div>

              <div className={styles.heroVisual} aria-label="Logistics dashboard with map, delivery routes, driver pins">
                <div className={styles.dashboardShell}>
                  <div className={styles.dashboardTopbar}>
                    <div className={styles.windowDots}>
                      <span />
                      <span />
                      <span />
                    </div>
                    <div className={styles.dashboardBadge}>Dispatch board</div>
                  </div>

                  <div className={styles.dashboardContent}>
                    <div className={styles.routeListCard}>
                      <div className={styles.cardHeader}>
                        <strong>Route planner</strong>
                        <span>18 stops</span>
                      </div>
                      <div className={styles.stopList}>
                        {["Sandton", "Midrand", "Rosebank", "Fourways"].map((stop) => (
                          <div key={stop} className={styles.stopRow}>
                            <span className={styles.stopDot} />
                            <div>
                              <strong>{stop}</strong>
                              <small>Driver stop list interface</small>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className={styles.mapCard}>
                      <div className={styles.mapLabel}>Map UI with delivery routes and pins</div>
                      <div className={styles.mapGrid} />
                      <div className={styles.routeStrokePrimary} />
                      <div className={styles.routeStrokeSecondary} />
                      <div className={styles.routeStrokeTertiary} />
                      {[
                        { top: "18%", left: "20%" },
                        { top: "32%", left: "68%" },
                        { top: "56%", left: "38%" },
                        { top: "70%", left: "78%" },
                      ].map((pin, index) => (
                        <span
                          key={`${pin.top}-${pin.left}`}
                          className={styles.mapPin}
                          style={
                            {
                              "--pin-top": pin.top,
                              "--pin-left": pin.left,
                              "--pin-delay": `${index * 0.45}s`,
                            } as CSSProperties
                          }
                        />
                      ))}
                      <div className={styles.floatingPanel}>
                        <p>Driver tracking dashboard</p>
                        <strong>12 active drivers</strong>
                        <span>3 routes ahead of schedule</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.trustSection}>
          <div className={styles.container}>
            <p className={styles.trustLabel}>Trusted by logistics, courier, and delivery teams</p>
            <div className={styles.logoRow}>
              {trustedBy.map((name) => (
                <div key={name} className={styles.logoItem}>
                  {name}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.problemSection}>
          <div className={styles.container}>
            <div className={styles.problemGrid}>
              <div>
                <SectionIntro
                  eyebrow="Problem"
                  title="Manual dispatch is slowing you down"
                  description="When planning, tracking, and communication live in different places, delivery performance becomes hard to control."
                />
                <div className={styles.problemList}>
                  {painPoints.map((item) => (
                    <div key={item} className={styles.problemItem}>
                      <span className={styles.checkMark}>+</span>
                      <p>{item}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={styles.beforeAfterCard}>
                <div className={styles.compareHeader}>
                  <strong>Before vs after route optimization map</strong>
                  <span>Messy routes reorganized into clean runs</span>
                </div>
                <div className={styles.compareMaps}>
                  <div className={styles.beforeMap}>
                    <div className={styles.compareLabel}>Before</div>
                    <span className={styles.messyRouteOne} />
                    <span className={styles.messyRouteTwo} />
                    <span className={styles.messyRouteThree} />
                  </div>
                  <div className={styles.afterMap}>
                    <div className={styles.compareLabel}>After</div>
                    <span className={styles.cleanRouteOne} />
                    <span className={styles.cleanRouteTwo} />
                    <span className={styles.cleanRouteThree} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.featuresSection}>
          <div className={styles.container}>
            <SectionIntro
              eyebrow="Capabilities"
              title="Everything dispatch teams need in one clean workflow"
              description="A product-first platform for planning routes, coordinating drivers, and delivering reliable customer updates."
            />
            <div className={styles.featuresGrid}>
              {features.map((feature) => {
                const Icon = feature.icon
                return (
                  <article key={feature.title} className={styles.featureCard}>
                    <span className={styles.featureIcon}>
                      <Icon size={18} />
                    </span>
                    <h3>{feature.title}</h3>
                    <p>{feature.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={styles.showcaseSection}>
          <div className={styles.container}>
            <SectionIntro
              eyebrow="Product Showcase"
              title="A logistics workspace that stays easy to read under pressure"
              description="Each surface is designed to lower cognitive load while keeping the most important route and delivery signals visible."
            />
            <div className={styles.showcaseStack}>
              {showcaseItems.map((item, index) => (
                <article key={item.title} className={styles.showcaseCard}>
                  <div className={styles.showcaseContent}>
                    <p className={styles.showcaseEyebrow}>{item.eyebrow}</p>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                    <div className={styles.showcasePoints}>
                      {item.points.map((point) => (
                        <span key={point}>{point}</span>
                      ))}
                    </div>
                  </div>

                  <div className={styles.showcaseVisual}>
                    <div className={styles.showcaseWindow}>
                      <div className={styles.showcaseWindowBar} />
                      <div className={styles.showcaseCanvas}>
                        <div className={styles.showcaseMockLabel}>{item.points[0]}</div>
                        <div className={styles.showcaseSidebar}>
                          <span />
                          <span />
                          <span />
                        </div>
                        <div
                          className={index === 1 ? styles.showcaseMapVisual : styles.showcaseChartVisual}
                        >
                          <i />
                          <i />
                          <i />
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.stepsSection}>
          <div className={styles.container}>
            <SectionIntro
              eyebrow="How It Works"
              title="Start with orders and finish with a controlled delivery day"
              description="A simple three-step operating loop for dispatchers, fleet managers, and customer teams."
            />
            <div className={styles.stepsGrid}>
              {steps.map((step, index) => {
                const Icon = step.icon
                return (
                  <article key={step.title} className={styles.stepCard}>
                    <div className={styles.stepTop}>
                      <span className={styles.stepIndex}>{index + 1}</span>
                      <span className={styles.stepIcon}>
                        <Icon size={18} />
                      </span>
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </section>

        <section className={styles.metricsSection}>
          <div className={styles.container}>
            <div className={styles.metricsCard}>
              {metrics.map((metric) => (
                <div key={metric.label} className={styles.metricItem}>
                  <strong>{metric.value}</strong>
                  <p>{metric.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.testimonialsSection}>
          <div className={styles.container}>
            <SectionIntro
              eyebrow="Testimonials"
              title="Operational teams adopt it quickly because it feels obvious"
              description="Clear surfaces, reliable route logic, and live delivery visibility make the product easier to trust day-to-day."
            />
            <div className={styles.testimonialGrid}>
              {testimonials.map((item) => (
                <article key={item.name} className={styles.testimonialCard}>
                  <div className={styles.avatar}>{item.name.slice(0, 1)}</div>
                  <p className={styles.quote}>&ldquo;{item.quote}&rdquo;</p>
                  <div className={styles.personBlock}>
                    <strong>{item.name}</strong>
                    <span>
                      {item.role}, {item.company}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="cta" className={styles.ctaSection}>
          <div className={styles.container}>
            <div className={styles.ctaCard}>
              <p className={styles.eyebrow}>Ready to optimize your deliveries?</p>
              <h2>Launch a more efficient dispatch operation with one modern platform.</h2>
              <p>
                Replace manual planning, fragmented tracking, and reactive delivery
                management with a cleaner operating system for logistics teams.
              </p>
              <div className={styles.ctaActions}>
                <Link href="/" className={styles.primaryButton}>
                  Start Free Trial
                </Link>
                <Link href="/" className={styles.secondaryButton}>
                  Book Demo
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerGrid}>
            <div className={styles.footerBrand}>
              <Link href="/" className={styles.brand}>
                <span className={styles.brandMark}>
                  <Truck size={16} />
                </span>
                <span>{appName}</span>
              </Link>
              <p>
                Product-centric dispatch software for route planning, live fleet
                visibility, and delivery management.
              </p>
            </div>

            {footerGroups.map((group) => (
              <div key={group.title} className={styles.footerColumn}>
                <h3>{group.title}</h3>
                {group.links.map((link) => (
                  <Link key={link} href="/" className={styles.footerLink}>
                    {link}
                  </Link>
                ))}
              </div>
            ))}
          </div>
          <div className={styles.footerBottom}>
            <span>© 2026 {appName}. All rights reserved.</span>
            <Link href="/docs" className={styles.footerDocs}>
              View documentation <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
