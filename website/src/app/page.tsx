import type { CSSProperties } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, ChevronDown, Menu, Truck } from "lucide-react"
import { MetricsCounters } from "@/components/home/metrics-counters"
import {
  ARCHITECTURE_NODES,
  INDUSTRIES,
  NAV_ITEMS,
  OUTCOMES,
  PAINS,
  SECURITY_ITEMS,
} from "./constants"
import styles from "./homepage.module.css"

export const metadata: Metadata = {
  title: "Pick n Drop | Logistics Operations Platform",
  description:
    "Dispatch, route, track, and analyze every delivery from one logistics command center.",
}

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Pick n Drop"

const workflowSteps = [
  "Capture orders from storefronts, ERPs, and internal tools.",
  "Auto-assign drivers and vehicles against live capacity.",
  "Continuously optimize routes as traffic and demand shift.",
  "Track deliveries live and trigger proof-of-delivery events instantly.",
]

const roiMetrics = [
  { label: "Faster Deliveries", value: 30, suffix: "%" },
  { label: "Lower Fuel Costs", value: 25, suffix: "%" },
  { label: "Reduced Idle Time", value: 20, suffix: "%" },
  { label: "Platform Availability", value: 99.99, suffix: "%" },
]

const testimonials = [
  {
    company: "Northbound Retail Group",
    quote:
      "Pick n Drop replaced three fragmented tools and gave every region the same operational playbook.",
    person: "Amina D.",
    role: "VP Logistics",
  },
  {
    company: "TransAxis 3PL",
    quote:
      "Dispatch teams now work from one live surface instead of bouncing between spreadsheets and carrier portals.",
    person: "David M.",
    role: "Head of Operations",
  },
  {
    company: "MetroFleet Courier",
    quote:
      "Webhook-driven updates finally made our customer timelines accurate enough to trust.",
    person: "Sara K.",
    role: "Chief Product Officer",
  },
]

const footerGroups = [
  {
    heading: "Platform",
    links: ["Dispatch", "Tracking", "Routing", "Analytics", "API Docs"],
  },
  {
    heading: "Solutions",
    links: ["Retail", "Grocery", "3PL", "Courier", "Enterprise"],
  },
  {
    heading: "Resources",
    links: ["Documentation", "Integrations", "Webhooks", "Case Studies"],
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
            {NAV_ITEMS.map((item) => (
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
            <summary
              className={styles.mobileMenuTrigger}
              aria-label="Open navigation menu"
            >
              <Menu size={18} />
              Menu
            </summary>
            <div className={styles.mobileMenuPanel}>
              <nav className={styles.mobileNavLinks} aria-label="Mobile navigation">
                {NAV_ITEMS.map((item) => (
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
                  Book a Demo
                </Link>
              </div>
            </div>
          </details>

          <div className={styles.headerActions}>
            <Link href="/auth/login" className={styles.textLink}>
              Login
            </Link>
            <Link href="#contact" className={styles.primaryBtn}>
              Book a Demo
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className={styles.heroSection}>
          <div className={styles.heroMedia} aria-hidden="true">
            <div className={styles.heroGrid} />
            <div className={styles.heroGlow} />
            <div className={styles.heroRoutePrimary} />
            <div className={styles.heroRouteSecondary} />
            <div className={styles.heroRouteTertiary} />
            {Array.from({ length: 10 }).map((_, index) => (
              <span
                key={`hero-node-${index}`}
                className={styles.heroNode}
                style={
                  {
                    "--hero-node-delay": `${index * 0.35}s`,
                    "--hero-node-top": `${12 + (index % 5) * 15}%`,
                    "--hero-node-left": `${18 + (index % 4) * 16}%`,
                  } as CSSProperties
                }
              />
            ))}
            <div className={styles.heroInterface}>
              <div className={styles.interfaceRail}>
                <span />
                <span />
                <span />
              </div>
              <div className={styles.interfaceHeader}>
                <strong>Live Operations</strong>
                <small>Dispatch surface</small>
              </div>
              <div className={styles.interfaceBody}>
                <div className={styles.interfaceColumn}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className={styles.interfaceMap}>
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.heroContent}>
            <p className={styles.heroBrand}>{appName}</p>
            <h1>Dispatch, route, and track every delivery from one command surface.</h1>
            <p className={styles.heroText}>
              Built for operators who need live fleet visibility, faster dispatch
              decisions, and customer updates that stay accurate under pressure.
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
          </div>
        </section>

        <section className={styles.painSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Why Teams Switch</p>
            <h2>Logistics breaks down when every handoff lives in a different tool.</h2>
            <p>
              Pick n Drop consolidates dispatch, routing, tracking, proof of
              delivery, and analytics into one operating model.
            </p>
          </div>
          <div className={styles.painGrid}>
            {PAINS.map((pain) => (
              <div key={pain} className={styles.painItem}>
                {pain}
              </div>
            ))}
          </div>
        </section>

        <section id="platform" className={styles.platformSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Platform Flow</p>
            <h2>One continuous system from order capture to final confirmation.</h2>
            <p>
              The platform stays coherent across dispatch desks, driver devices,
              customer updates, and performance reporting.
            </p>
          </div>
          <div className={styles.archFlow}>
            {ARCHITECTURE_NODES.map((node, index) => (
              <div key={node} className={styles.archNodeWrap}>
                <div className={styles.archNode}>{node}</div>
                {index < ARCHITECTURE_NODES.length - 1 ? (
                  <span className={styles.archArrow} aria-hidden>
                    <span className={styles.pulseDot} />
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        <section id="products" className={styles.outcomesSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Operational Outcomes</p>
            <h2>The page should promise measurable control, not vague efficiency.</h2>
            <p>
              These are the core gains logistics teams expect after replacing
              fragmented workflows with a single live surface.
            </p>
          </div>
          <div className={styles.outcomesGrid}>
            {OUTCOMES.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.title} className={styles.outcomeItem}>
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
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Workflow</p>
            <h2>Operations stay visible at every stage instead of disappearing between teams.</h2>
            <p>
              From inbound demand to proof of delivery, each step updates the
              same live timeline.
            </p>
          </div>
          <ol className={styles.workflowList}>
            {workflowSteps.map((step, index) => (
              <li key={step}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className={styles.roiSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Measured Impact</p>
            <h2>Performance gains need to feel operational, not ornamental.</h2>
          </div>
          <MetricsCounters metrics={roiMetrics} />
        </section>

        <section id="industries" className={styles.industriesSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Industries</p>
            <h2>Configured for the realities of each delivery model.</h2>
            <p>
              Same platform, different operational constraints. Routing logic,
              tracking behavior, and dispatch flows adapt to the work.
            </p>
          </div>
          <div className={styles.industriesGrid}>
            {INDUSTRIES.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.label} href={item.href} className={styles.industryLink}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </section>

        <section className={styles.apiSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>API First</p>
            <h2>Integrations are part of the product, not an afterthought.</h2>
            <p>
              Connect storefronts, ERPs, carriers, and internal services through
              REST APIs, event streams, and webhooks.
            </p>
          </div>
          <div className={styles.codePanel}>
            <div className={styles.codeTitle}>Webhook Payload</div>
            <pre>
{`{
  "delivery_id": "DLV-12345",
  "status": "IN_TRANSIT",
  "eta": "2026-03-26T12:18:00Z",
  "driver": "DRV-204"
}`}
            </pre>
          </div>
        </section>

        <section className={styles.securitySection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Trust Layer</p>
            <h2>Enterprise controls should read as baseline, not optional add-ons.</h2>
          </div>
          <div className={styles.securityGrid}>
            {SECURITY_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <article key={item.label} className={styles.securityItem}>
                  <Icon size={18} />
                  <span>{item.label}</span>
                </article>
              )
            })}
          </div>
        </section>

        <section className={styles.testimonialsSection}>
          <div className={styles.sectionHeading}>
            <p className={styles.sectionEyebrow}>Customer Signal</p>
            <h2>Used by operators who care about control, uptime, and reliable delivery promises.</h2>
          </div>
          <div className={styles.testimonialGrid}>
            {testimonials.map((item) => (
              <article key={item.company} className={styles.testimonialItem}>
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
          <p className={styles.sectionEyebrow}>Start Moving</p>
          <h2>Launch a cleaner logistics front door for your team and your customers.</h2>
          <p>
            Roll out with implementation support, API guidance, and a delivery
            workflow tailored to your operating model.
          </p>
          <div className={styles.contactActions}>
            <Link href="#" className={styles.primaryBtn}>
              Start Free Trial
            </Link>
            <Link href="#" className={styles.secondaryBtn}>
              Contact Sales
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
