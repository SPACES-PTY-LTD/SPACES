import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { publishedContent } from "@/lib/website/public";
import "./marketing.css";
import { features, industries, catalogueHref } from "@/lib/website/catalogue";
import { MarketingNavigation, type NavItem } from "./mobile-menu";
export async function MarketingShell({
    children,
    home = false,
}: {
    children: ReactNode;
    home?: boolean;
}) {
    const contents = await publishedContent();
    const items: NavItem[] = [
        {
            label: "Platform",
            href: "/platform",
            children: features.map((feature) => ({ label: feature.title, description: feature.description, group: feature.group, href: catalogueHref("platform", feature.id, contents) })),
        },
        {
            label: "Industries",
            href: "/industries",
            children: industries.map((industry) => ({ label: industry.title, description: industry.description, href: catalogueHref("industries", industry.id, contents) })),
        },
        ...(contents?.some((p) => p.slug === "security")
            ? [{ label: "Security", href: "/security" }]
            : []),
        {
            label: "Resources",
            href: "/resources",
            children: [
                { label: "FAQs", href: "/faq", description: "Answers about the platform and getting started." },
                {
                    label: "Blog",
                    href: "/blog",
                    description: "Practical ideas for your operation.",
                },
                {
                    label: "Support centre",
                    href: "/support",
                    description: "Guides and answers for your team.",
                },
                {
                    label: "Developer documentation",
                    href: "/docs",
                    description: "Build with the merchant API.",
                },
            ],
        },
        {
            label: "Company",
            href: "/company",
            children: [
                { label: "About Spaces", href: "/company", description: "Our purpose and the work behind the platform." },
                { label: "Careers", href: "/careers", description: "Explore our work and published opportunities." },
                { label: "Contact us", href: "/contact", description: "Talk about your operation or find the right support." },
            ],
        },
    ];
    const legal = (contents ?? []).filter((p) =>
        ["privacy", "terms"].includes(p.slug),
    );
    const published = new Set((contents ?? []).map((p) => p.slug));
    const destination = (slug: string, fallback: string) =>
        (published.has(slug) || features.some(feature => slug === `platform/${feature.id}`)) ? `/${slug}` : fallback;
    const footerGroups = [
        {
            title: "Platform",
            links: [
                ["Platform overview", "/platform"],
                [
                    "Scheduling & runs",
                    destination("platform/scheduling", "/#planning"),
                ],
                [
                    "Fleet tracking",
                    destination("platform/tracking", "/#visibility"),
                ],
                [
                    "Driver app",
                    destination("platform/driver-app", "/#documents"),
                ],
                [
                    "Delivery documents",
                    destination("platform/documents", "/#documents"),
                ],
                [
                    "Location automation",
                    destination("platform/automation", "/#visibility"),
                ],
                [
                    "Reporting & analytics",
                    destination("platform/reporting", "/#reporting"),
                ],
                [
                    "Integrations & API",
                    destination("platform/integrations", "/#integrations"),
                ],
            ],
        },
        {
            title: "Industries",
            links: [
                ["All industries", "/industries"],
                ...industries.map(industry => [industry.title, catalogueHref("industries", industry.id, contents)]),
            ],
        },
        {
            title: "Resources",
            links: [
                ["Resource library", "/resources"],
                ["Blog & insights", "/blog"],
                ["Frequently asked questions", "/faq"],
                ["Developer documentation", "/docs"],
            ],
        },
        {
            title: "Support",
            links: [
                ["Support centre", "/support"],
                ["Administrator guides", "/support?category=Administrators"],
                ["Dispatcher guides", "/support?category=Dispatchers"],
                ["Driver guides", "/support?category=Drivers"],
                ["Integration help", "/support?category=Integrations"],
                ["Sign in for support tickets", "/admin/support"],
            ],
        },
        {
            title: "Company",
            links: [
                ["About Spaces", "/company"],
                ["Contact us", "/contact"],
                ["Careers", "/careers"],
                ["Security", destination("security", "/#security")],
                ["Book a demo", "/book-demo"],
                ["Log in", "/auth/login"],
            ],
        },
    ];
    return (
        <div className={`marketing${home ? " marketing-home" : ""}`}>
            <a className="skip-link" href="#main-content">
                Skip to content
            </a>
            <header className="site-header">
                <Link className="wordmark" href="/">
                    spaces<span>digital</span>
                </Link>
                <MarketingNavigation items={items} />
                <div className="header-actions">
                    <Link href="/support">Support</Link>
                    <Link href="/auth/login">Log in</Link>
                    <Link className="cta" href="/book-demo">
                        Book a demo <span aria-hidden>↗</span>
                    </Link>
                </div>
            </header>
            <main id="main-content">{children}</main>
            <footer className="site-footer">
                <div className="footer-intro">
                    <div>
                        <Link className="wordmark" href="/">
                            spaces<span>digital</span>
                        </Link>
                        <p>
                            Keep your operation connected.
                            <br />
                            From dispatch to delivery documents.
                        </p>
                    </div>
                </div>
                <nav
                    className="footer-directory"
                    aria-label="Footer navigation"
                >
                    {footerGroups.map((group) => (
                        <div className="footer-link-group" key={group.title}>
                            <h3>{group.title}</h3>
                            <ul>
                                {group.links.map(([label, href]) => (
                                    <li key={label}>
                                        <Link href={href}>{label}</Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </nav>
                <div className="footer-bottom">
                    <small>© {new Date().getFullYear()} Spaces Digital</small>
                    <div
                        className="footer-legal"
                        aria-label="Legal and site links"
                    >
                        {legal.map((p) => (
                            <Link href={`/${p.slug}`} key={p.id}>
                                {p.content.title}
                            </Link>
                        ))}
                        <Link href="/contact">
                            Privacy & security enquiries
                        </Link>
                        <a href="#main-content">Back to top ↑</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
export function PageIntro({
    eyebrow,
    title,
    description,
}: {
    eyebrow?: string;
    title: string;
    description: string;
}) {
    return (
        <section className="page-intro">
            <p className="eyebrow">{eyebrow ?? "Spaces Digital"}</p>
            <h1>{title}</h1>
            <p className="lede">{description}</p>
        </section>
    );
}
export function DemoCTA() {
    return (
        <section className="demo-invitation" aria-label="Explore Spaces in a demo">
            <div className="demo-invitation-copy">
                <h2>Join thousands of satisfied customers using Spaces Digital</h2>
                <p className="demo-invitation-description">Bring your workflow. Explore how Spaces connects your planning, drivers and delivery documents in a 30-minute demo.</p>
                <Link className="cta" href="/book-demo">
                    Book a demo <ArrowRight size={20} aria-hidden="true" />
                </Link>
            </div>
        </section>
    );
}
