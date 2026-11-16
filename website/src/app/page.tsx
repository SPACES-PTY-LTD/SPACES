import { withBlogLibrary } from "@/lib/website/blog-posts";
import { features as platformFeatures, industries as industryCatalogue } from "@/lib/website/catalogue";
import type { Metadata } from "next";
import { FileSearch, Timer, Truck, CodeXml, Radio } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { IndustryExplorer } from "@/components/marketing/industry-explorer";
import { SolutionPanels } from "@/components/marketing/solution-panels";
import { WorkflowTabs } from "@/components/marketing/workflow-tabs";
import { HeroCarousel } from "@/components/marketing/hero-carousel";
import { MarketingVisual } from "@/components/marketing/visual";
import { MarketingShell, DemoCTA } from "@/components/marketing/shell";
import { publishedContent } from "@/lib/website/public";

export const metadata: Metadata = {
    title: "Spaces Digital | Transport & delivery management software",
    description:
        "Connect shipment planning, dispatch, vehicle visibility, drivers and delivery documents. Explore logistics software for South African transport and delivery teams.",
};

const workflows = [
    {
        id: "planning",
        eyebrow: "01 / Plan & dispatch",
        title: "Plan runs. Assign drivers. Keep dispatch organised.",
        description:
            "Build each run around its shipments, stops, driver and vehicle. Review assignments in one scheduling workspace so dispatchers can see what is planned and what still needs attention.",
        points: [
            "See assigned runs and shipments waiting for dispatch.",
            "Keep collection and delivery stops with each run.",
            "Check run status before making the next assignment.",
        ],
        note: "Route planning helps you review the intended journey and stop order.",
        visual: "schedule",
        slug: "platform/scheduling",
        link: "Explore scheduling & runs",
    },
    {
        id: "visibility",
        eyebrow: "02 / Follow the operation",
        title: "Know where to look when the plan changes.",
        description:
            "Bring vehicle activity, locations and run information together. Move from an operational overview to a recorded journey when a delay or exception needs a closer look.",
        points: [
            "Review vehicle positions with their operational context.",
            "Explore recorded GPS history and stop events.",
            "Use geofences and supported arrival or departure rules around your locations.",
        ],
        note: "Position availability and freshness depend on the connected tracking source. Confirm supported integrations during onboarding.",
        visual: "monitor",
        slug: "platform/tracking",
        link: "Explore fleet visibility",
    },
    {
        id: "documents",
        eyebrow: "03 / Drivers & delivery documents",
        title: "Bring the delivery record back into the workflow.",
        description:
            "Connect the driver’s assigned work with the office. Drivers can upload delivery notes, review extracted shipment details and confirm the information before it becomes part of the operational record.",
        points: [
            "Give drivers a mobile view of assigned runs and shipments.",
            "Capture and import delivery documents with a review step.",
            "Associate documents with shipments and find records that need follow-up.",
        ],
        note: "Document capture stores the uploaded record; it does not independently verify a signature or prove that a handover took place.",
        visual: "documents",
        slug: "platform/documents",
        link: "Explore delivery documents",
    },
    {
        id: "reporting",
        eyebrow: "04 / Review & improve",
        title: "Spot missing documents, waiting time and exceptions.",
        description:
            "Review shipment records, time spent at locations and vehicle activity. Use document and operational reports to identify what needs follow-up.",
        points: [
            "Find missing delivery documents and records approaching expiry.",
            "Review waiting-time, stop-analysis and speeding reports.",
            "Check shipment activity and daily vehicle records.",
        ],
        note: "",
        visual: "reporting",
        slug: "platform/reporting",
        link: "Explore reporting & analytics",
    },
    {
        id: "integrations",
        eyebrow: "05 / Connect your systems",
        title: "Connect your tracking provider and business systems.",
        description:
            "Bring tracking data into Spaces through supported provider connections. Use the documented API to build integrations around shipment, quote and booking records.",
        points: [
            "Access shipment, quote, booking and webhook documentation.",
            "Explore MiX/Powerfleet and Fleetboard connection options.",
            "Check account access and required data before connecting.",
        ],
        note: "",
        visual: "api",
        slug: "platform/integrations",
        link: "Explore integrations & API",
    },
];
const industrySummaries: Record<(typeof industryCatalogue)[number]["id"], string> = {
    "road-freight": "Assign drivers and vehicles to freight runs, review recorded journeys and keep delivery notes with each shipment.",
    "wholesale-distribution": "Organise depot shipments into delivery runs and give the office a place to review customer delivery documents.",
    "courier-operations": "Keep daily run assignments, driver uploads and shipment records together so dispatch can follow up on missing information.",
    "retail-delivery": "Plan store and customer deliveries, assign vehicles and review the delivery records returned by drivers.",
    "fuel-depots": "Coordinate tanker runs, review connected vehicle journeys and organise delivery documents for depot follow-up.",
};
const industries = industryCatalogue.map(industry => ({ title: industry.title, slug: industry.id, text: industrySummaries[industry.id] }));
const faqs = [
    [
        "What can we manage in Spaces?",
        "Manage shipments, plan runs, assign drivers and vehicles, review connected tracking data and keep delivery documents with each shipment. Reports help your team follow up on missing records and operational exceptions.",
    ],
    [
        "Can we use our existing vehicle tracking provider?",
        "Spaces has MiX/Powerfleet and Fleetboard connection options. Our team will confirm whether your provider account supplies the required access and data. Vehicle positions and journey history depend on that connection.",
    ],
    [
        "Does route planning include automatic optimisation?",
        "Spaces supports route planning and reviewing stop order. Automatic route optimisation is not currently a verified capability. Bring a typical run to your demo to see the planning tools available.",
    ],
    [
        "What can drivers do in the mobile app?",
        "Drivers can view their assigned runs and shipments, upload delivery notes and review extracted shipment details before confirming them. The mobile workflow requires the appropriate device permissions and connectivity.",
    ],
    [
        "How do we discuss subscription options?",
        "Spaces is a paid subscription service. Contact the team to discuss your fleet size, operational requirements and subscription options.",
    ],
    [
        "Where does our team get help?",
        "Browse the FAQs and available support guides. Customer users with web-admin access can sign in to create and follow private tickets for their organisation. Driver accounts cannot create tickets.",
    ],
];

export default async function Home() {
    const content = (await publishedContent()) ?? [];
    const published = new Set(content.map((p) => p.slug));
    const featureHref = (slug: string) =>
        (published.has(slug) || platformFeatures.some(feature => slug === `platform/${feature.id}`) || industryCatalogue.some(industry => slug === `industries/${industry.id}`)) ? `/${slug}` : "/book-demo";
    const articles = withBlogLibrary(content)
        .filter((p) => p.kind === "blog")
        .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
        .slice(0, 3);
    function featureCopy(item: (typeof workflows)[number]) {
        return (
            <>
                <p className="eyebrow">{item.eyebrow}</p>
                <h3 className="feature-heading">{item.title}</h3>
                <p className="lede">{item.description}</p>
                {item.id === "planning" ? (
                    <ol className="dispatch-steps" aria-label="Planning a run">
                        {[
                            ["Review the work", "See assigned runs and shipments waiting for dispatch."],
                            ["Organise the stops", "Keep collection and delivery stops with each run."],
                            ["Check before assigning", "Review run status before making the next assignment."],
                        ].map(([title, text], index) => (
                            <li key={title}>
                                <span className="dispatch-step-number" aria-hidden="true">0{index + 1}</span>
                                <div><h4>{title}</h4><p>{text}</p></div>
                            </li>
                        ))}
                    </ol>
                ) : item.id === "reporting" ? (
                    <ul className="reporting-highlights" aria-label="Available operational reports">
                        {[
                            { title: "Documents", text: "Find missing delivery notes and records nearing expiry.", Icon: FileSearch },
                            { title: "Time & stops", text: "Review waiting time, stop analysis and speeding reports.", Icon: Timer },
                            { title: "Vehicle activity", text: "Check shipment activity and daily vehicle records.", Icon: Truck },
                        ].map(({ title, text, Icon }) => (
                            <li key={title}>
                                <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
                                <h4>{title}</h4>
                                <p>{text}</p>
                            </li>
                        ))}
                    </ul>
                ) : item.id === "integrations" ? (
                    <div className="integration-options">
                        <div className="integration-options-grid">
                            <div className="integration-option">
                                <CodeXml size={28} strokeWidth={1.5} aria-hidden="true" />
                                <h4>Build with the API</h4>
                                <p>Connect shipment, quote and booking records using documented interfaces and webhooks.</p>
                                <Link href="/docs">Developer documentation <span aria-hidden="true">↗</span></Link>
                            </div>
                            <div className="integration-option">
                                <Radio size={28} strokeWidth={1.5} aria-hidden="true" />
                                <h4>Connect vehicle tracking</h4>
                                <p>Explore supported provider connections for your fleet.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <ul className="feature-benefits">
                        {item.points.map((point) => (
                            <li key={point}>{point}</li>
                        ))}
                    </ul>
                )}
                <Link className="home-text-link" href={featureHref(item.slug)}>
                    {(published.has(item.slug) || platformFeatures.some(feature => item.slug === `platform/${feature.id}`))
                        ? item.link
                        : "See this workflow in a demo"}{" "}
                    →
                </Link>
                {item.note && <p className="feature-context">{item.note}</p>}
            </>
        );
    }
    return (
        <MarketingShell home>
            <section className="hero hero-wide">
                <div>
                    <p className="eyebrow">
                        Transport & delivery management software
                    </p>
                    <h1>
                        Plan, Track &amp; manage
                        <br />
                        your shipments
                    </h1>
                </div>
                <div>
                    <p className="lede">
                        Spaces connects shipment planning, driver assignments,
                        vehicle tracking and delivery documents. Give your office
                        and drivers a shared record of the work, from dispatch
                        to delivery-note review.
                    </p>
                    <div className="hero-actions">
                        <Link className="cta" href="/book-demo">
                            Book a demo ↗
                        </Link>
                        <Link className="cta secondary" href="#how-it-works">
                            See how it works ↓
                        </Link>
                    </div>
                    <p className="hero-audience">
                        For South African transport operators, distributors,
                        couriers, retail delivery teams and fuel depots.
                    </p>
                </div>
            </section>
            <HeroCarousel />
            <nav className="home-jump-links" aria-label="Explore this page">
                <span>Explore Spaces</span>
                <a href="#how-it-works">How it works</a>
                <a href="#capabilities">Capabilities</a>
                <a href="#industries">Industries</a>
                <a href="#questions">FAQs</a>
            </nav>
            <section className="section-wrap home-problems light-section">
                <div className="section-head">
                    <div>
                        <p className="eyebrow">Our solution</p>
                        <h2>Why choose Spaces Digital fleet management software?</h2>
                    </div>
                </div>
                <SolutionPanels />
            </section>
            <section className="home-platform-band" id="how-it-works">
                <div className="section-wrap">
                    <p className="eyebrow">Operations</p>
                    <h2>Easy shipments management</h2>
                    <p className="lede">
                        Assign the work, follow the journey, collect delivery
                        documents and review exceptions. See how each step
                        connects in Spaces.
                    </p>
                    <WorkflowTabs />
                    <Link className="home-text-link" href="/platform">
                        Explore the platform overview →
                    </Link>
                </div>
            </section>
            <section
                className="section-wrap home-section-intro"
                id="capabilities"
            >
                <p className="eyebrow">Inside the platform</p>
                <h2>Tools for every stage of your delivery operation.</h2>
                <p className="lede">
                    Explore the workflows your team can use from planning
                    through to document review and reporting.
                </p>
            </section>
            <section
                className="section-wrap feature-chapter planning-chapter"
                id="planning"
            >
                <div className="chapter-copy">{featureCopy(workflows[0])}</div>
                <div className="chapter-composition">
                    <Image
                        src="/images/marketing/carousel-dispatch-photo.webp"
                        alt="Generated scene of dispatchers reviewing the working day."
                        width={1200}
                        height={800}
                        sizes="(max-width:760px) 90vw, 50vw"
                        className="chapter-photo"
                    />
                    <MarketingVisual name="schedule" />

                </div>
            </section>
            <section className="execution-chapter light-section">
                <div className="section-wrap">
                    <p className="eyebrow">Execution</p>
                    <h2>Track vehicle location and Shipment Documents</h2>
                    <div className="execution-grid">
                        {[
                            {
                                ...workflows[1],
                                heading: "Track vehicle location",
                                summary: "Check vehicle positions and recorded journeys to understand delays and follow up with your team.",
                                detail: "Tracking availability and freshness depend on your connected provider.",
                                label: "Explore fleet tracking",
                            },
                            {
                                ...workflows[2],
                                heading: "Upload and extract delivery note data using AI",
                                summary: "Drivers upload delivery notes. Your team reviews the details and links each document to the right shipment.",
                                detail: "Uploaded documents remain available for review and follow-up.",
                                label: "Explore delivery documents",
                            },
                        ].map((item) => (
                            <article className="execution-feature" id={item.id} key={item.id}>
                                <MarketingVisual name={item.visual} />
                                <div className="execution-copy">
                                    <h3>{item.heading}</h3>
                                    <p>{item.summary}</p>
                                    <p className="execution-detail">{item.detail}</p>
                                    <Link className="home-text-link" href={featureHref(item.slug)}>
                                        {item.label} <span aria-hidden="true">→</span>
                                    </Link>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <section className="section-wrap oversight-chapter">
                <p className="eyebrow">Oversight & connections</p>
                <h2>Turn operational data into clear next steps.</h2>
                {[workflows[3], workflows[4]].map((item) => (
                    <article
                        className="oversight-row"
                        id={item.id}
                        key={item.id}
                    >
                        <MarketingVisual name={item.visual} />
                        <div>{featureCopy(item)}</div>
                    </article>
                ))}
            </section>
            <section className="home-role-band">
                <div className="section-wrap">
                    <p className="eyebrow">
                        Tools for your team
                    </p>
                    <h2>Give each team the tools for its role.</h2>
                    <div className="home-three-grid">
                        {[
                            [
                                "Dispatchers",
                                "Keep dispatch organised.",
                                "Assign shipments to runs, choose drivers and vehicles, and check which work still needs an assignment.",
                            ],
                            [
                                "Drivers",
                                "View runs and upload delivery notes.",
                                "Open assigned runs and shipment details on mobile, then upload delivery notes for review.",
                            ],
                            [
                                "Administrators & managers",
                                "Manage access and review performance.",
                                "Manage user access and operational settings. Review shipment, vehicle and document reports to identify follow-up work.",
                            ],
                        ].map(([role, title, text]) => (
                            <article className="marketing-card" key={role}>
                                <p className="eyebrow">{role}</p>
                                <h3>{title}</h3>
                                <p>{text}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>
            <section className="section-wrap light-section" id="industries">
                <div className="section-head">
                    <div>
                        <p className="eyebrow">
                            Industries we serve
                        </p>
                        <h2>Works for different industries</h2>
                    </div>
                    <Link className="home-text-link" href="/industries">
                        Explore industries →
                    </Link>
                </div>
                <IndustryExplorer industries={industries} />
            </section>
            <section className="section-wrap trust-section" id="security">
                <div>
                    <p className="eyebrow">Security & access</p>
                    <h2>
                        Control who can access
                        <br />
                        your operational data.
                    </h2>
                    <p className="lede">
                        Use role-based permissions and organisation access
                        restrictions to control who can work with your records.
                        Review security requirements with our team before rollout.
                    </p>
                    <Link
                        className="cta secondary"
                        href={
                            published.has("security") ? "/security" : "/contact"
                        }
                    >
                        {published.has("security")
                            ? "Read about security"
                            : "Discuss security with us"}{" "}
                        →
                    </Link>
                </div>
                <div className="trust-list">
                    <article>
                        <h3>Role-based access</h3>
                        <p>
                            User roles control access to administrative functions.
                            Organisation restrictions limit which business
                            records each user can access.
                        </p>
                    </article>
                    <article>
                        <h3>Protected credentials</h3>
                        <p>
                            Passwords are stored as hashes, and integration
                            settings are encrypted in storage.
                        </p>
                    </article>
                    <article>
                        <h3>Private support conversations</h3>
                        <p>
                            Support tickets and attachments require sign-in and
                            access to the relevant organisation. They are not
                            part of the public help centre.
                        </p>
                    </article>
                </div>
            </section>
            <section className="section-wrap home-resources light-section">
                <div className="section-head">
                    <div>
                        <p className="eyebrow">Insights & guides</p>
                        <h2>Practical guides for transport and delivery teams.</h2>
                    </div>
                    <Link className="home-text-link" href="/resources">
                        Explore resources →
                    </Link>
                </div>
                <div className="home-three-grid">
                    {articles.length
                        ? articles.map((article) => (
                              <Link
                                  className="marketing-card resource-preview"
                                  href={`/${article.slug}`}
                                  key={article.id}
                              >
                                  <div className="resource-cover">
                                      {article.content.image ? (
                                          <img
                                              src={article.content.image}
                                              alt={
                                                  article.content.image_alt ??
                                                  ""
                                              }
                                              loading="lazy"
                                          />
                                      ) : (
                                          <Image
                                              src="/images/marketing/carousel-dispatch-photo.webp"
                                              alt=""
                                              fill
                                              sizes="(max-width:760px) 90vw, 33vw"
                                          />
                                      )}
                                  </div>
                                  <div className="resource-copy">
                                      <p className="eyebrow">
                                          {article.kind === "blog"
                                              ? "Article"
                                              : "Product update"}
                                      </p>
                                      <h3>{article.content.title}</h3>
                                      <p>{article.content.description}</p>
                                      <p className="resource-meta">
                                          {article.content.author && (
                                              <span>
                                                  {article.content.author}{" "}
                                                  ·{" "}
                                              </span>
                                          )}
                                          <time dateTime={article.published_at}>
                                              {new Intl.DateTimeFormat(
                                                  "en-ZA",
                                                  {
                                                      day: "numeric",
                                                      month: "short",
                                                      year: "numeric",
                                                      timeZone:
                                                          "Africa/Johannesburg",
                                                  },
                                              ).format(
                                                  new Date(
                                                      article.published_at,
                                                  ),
                                              )}
                                          </time>
                                      </p>
                                      <span className="arrow">Read more →</span>
                                  </div>
                              </Link>
                          ))
                        : [
                              [
                                  "Practical help",
                                  "Find setup and product guidance",
                                  "Browse FAQs and available guides for account setup, dispatch and driver workflows.",
                                  "/support",
                              ],
                              [
                                  "Developer documentation",
                                  "Explore the API documentation",
                                  "Review authentication and available merchant API interfaces before building an integration.",
                                  "/docs",
                              ],
                              [
                                  "Talk to the team",
                                  "Discuss your requirements",
                                  "Discuss your tracking setup, document requirements or how a typical run should work.",
                                  "/contact",
                              ],
                          ].map(([eyebrow, title, text, href], index) => (
                              <Link
                                  className="marketing-card resource-preview"
                                  href={href}
                                  key={href}
                              >
                                  <div className="resource-cover">
                                      <Image
                                          src={`/images/marketing/${["carousel-driver-photo.webp", "feature-api-transparent.png", "carousel-dispatch-photo.webp"][index]}`}
                                          alt=""
                                          fill
                                          sizes="(max-width:760px) 90vw, 33vw"
                                      />
                                  </div>
                                  <div className="resource-copy">
                                      <p className="eyebrow">{eyebrow}</p>
                                      <h3>{title}</h3>
                                      <p>{text}</p>
                                      <span className="arrow">Explore →</span>
                                  </div>
                              </Link>
                          ))}
                </div>
            </section>
            <section className="section-wrap faq-section" id="questions">
                <div>
                    <p className="eyebrow">Frequently asked questions</p>
                    <h2>
                        What to know
                        <br />
                        before you get started.
                    </h2>
                    <p className="lede">
                        Find out how tracking connections, driver workflows,
                        subscriptions and support work in Spaces.
                    </p>
                    <Link className="home-text-link" href="/faq">
                        View all FAQs →
                    </Link>
                </div>
                <div className="faq-list">
                    {faqs.map(([question, answer]) => (
                        <details key={question}>
                            <summary>
                                {question}
                                <span aria-hidden>+</span>
                            </summary>
                            <p>{answer}</p>
                        </details>
                    ))}
                </div>
            </section>
            <DemoCTA />
        </MarketingShell>
    );
}
