import { requireDocumentationAccess } from "@/lib/documentation/require-access";
import { protectedDocumentationPath } from "@/lib/documentation/access";
import { BlogIndex, BlogLanding, BlogCards } from "@/components/marketing/blog";
import { blogArticle, withBlogLibrary } from "@/lib/website/blog-posts";
import { IndustryLanding } from "@/components/marketing/industry-landing";
import { industryForSlug, industryPages } from "@/lib/website/industry-pages";
import { FeatureLanding } from "@/components/marketing/feature-landing";
import { platformFeature, featurePages } from "@/lib/website/feature-pages";
import { Discovery } from "@/components/marketing/discovery";
import { MarketingVisual, visualForSlug, marketingVisuals } from "@/components/marketing/visual";
import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { publishedContent } from "@/lib/website/public";
import { PageIntro, DemoCTA } from "@/components/marketing/shell";
const hubs: Record<
    string,
    { title: string; description: string; prefix?: string; kind?: string }
> = {
    platform: {
        title: "One platform. Connected operations.",
        description:
            "Explore the workflows connecting shipments, vehicles, drivers and delivery records.",
        prefix: "platform/",
    },
    industries: {
        title: "Built around the work you do.",
        description:
            "Explore operational workflows for South African transport and delivery teams.",
        prefix: "industries/",
    },
    resources: {
        title: "Practical knowledge. Shared openly.",
        description:
            "Product guidance and practical operational ideas from the team.",
    },
    blog: {
        title: "Ideas for a clearer operation.",
        description: "Practical articles from the Spaces Digital team.",
        kind: "blog",
    },
};
export async function generateMetadata({
    params,
}: {
    params: Promise<{ slug: string[] }>;
}): Promise<Metadata> {
    const slug = (await params).slug.join("/");
    if (protectedDocumentationPath(`/${slug}`)) await requireDocumentationAccess(`/${slug}`);
    const feature = platformFeature(slug);
    const industry = industryForSlug(slug);
    const p = withBlogLibrary(await publishedContent()).find((p) => p.slug === slug);
    const title =
        p?.content.seo_title ??
        p?.content.title ??
        (feature ? featurePages[feature.id].headline : undefined) ??
        (industry ? industryPages[industry.id].headline : undefined) ??
        hubs[slug]?.title ??
        "Page unavailable";
    const description =
        p?.content.seo_description ??
        p?.content.description ??
        (feature ? featurePages[feature.id].intro : industry ? industryPages[industry.id].intro : hubs[slug]?.description);
    return {
        title: `${title} | Spaces Digital`,
        description,
        alternates: { canonical: `/${slug}` },
        openGraph: {
            title,
            description,
            ...(p?.content.image ? { images: [p.content.image] } : feature ? { images: [`/images/marketing/${marketingVisuals[`hero-${feature.id}`].file}`] } : industry ? { images: [`/images/marketing/industry-${industry.id}.webp`] } : {}),
        },
    };
}
export default async function ContentPage({
    params,
}: {
    params: Promise<{ slug: string[] }>;
}) {
    const slug = (await params).slug.join("/");
    if (protectedDocumentationPath(`/${slug}`)) await requireDocumentationAccess(`/${slug}`);
    const all = await publishedContent();
    const article = blogArticle(slug);
    if (article && !all?.some(page => page.slug === slug)) return <BlogLanding article={article} />;
    if (slug === "blog") return <BlogIndex posts={withBlogLibrary(all).filter(page => page.kind === "blog").sort((a,b) => Date.parse(b.published_at)-Date.parse(a.published_at))} />;
    const feature = platformFeature(slug);
    const industry = industryForSlug(slug);
    if (industry) return <IndustryLanding industry={industry} editorial={all?.find(page => page.slug === slug)} />;
    if (feature) return <FeatureLanding feature={feature} editorial={all?.find(page => page.slug === slug)} />;
    if (slug === "platform" || slug === "industries") return <Discovery section={slug} contents={all} />;
    if (hubs[slug]) {
        const hubContent = all?.find((p) => p.slug === slug)?.content;
        const h = {
            ...hubs[slug],
            ...(hubContent
                ? {
                      title: hubContent.title,
                      description: hubContent.description,
                  }
                : {}),
        };
        const items = (slug === "resources" ? withBlogLibrary(all) : (all ?? [])).filter((p) =>
            h.prefix
                ? p.slug.startsWith(h.prefix)
                : h.kind
                  ? p.kind === h.kind
                  : p.kind === "blog",
        );
        return (
            <>
                <PageIntro title={h.title} description={h.description} />
                {hubContent && (
                    <div
                        className="prose"
                        dangerouslySetInnerHTML={{ __html: hubContent.body }}
                    />
                )}
                <section className="section-wrap">
                    {slug === "resources" && (
                        <div className="support-categories">
                            <Link href="/blog">Blog</Link>
                            <Link href="/support">Guides & FAQs</Link>
                            <Link href="/docs">Developer documentation</Link>
                        </div>
                    )}
                    {slug === "resources" ? <BlogCards posts={items} /> : <div className="card-grid">
                        {items.map((p) => (
                            <Link
                                className="marketing-card"
                                key={p.id}
                                href={`/${p.slug}`}
                            >
                                <p className="eyebrow">
                                    {p.kind === "page" ? "Explore" : p.kind}
                                </p>
                                {visualForSlug(p.slug) && (
                                    <MarketingVisual
                                        name={visualForSlug(p.slug)!}
                                    />
                                )}
                                <h2>{p.content.title}</h2>
                                <p>{p.content.description}</p>
                                <span className="arrow">Read more ↗</span>
                            </Link>
                        ))}
                    </div>}
                    {items.length === 0 && (
                        <p className="notice">
                            {all === null
                                ? "We couldn’t load this content. Please try again shortly."
                                : "New articles will appear here when published. In the meantime, explore our support guides or book a demo."}
                        </p>
                    )}
                    {slug === "platform" && (
                        <p>
                            <Link href="/docs">
                                Explore the API documentation ↗
                            </Link>
                        </p>
                    )}
                </section>
                <DemoCTA />
            </>
        );
    }
    if (all === null)
        return (
            <PageIntro
                title="This page is temporarily unavailable"
                description="We couldn’t load the content. Please try again shortly."
            />
        );
    const page = all.find((p) => p.slug === slug);
    if (!page) notFound();
    const c = page.content;
    if (slug.startsWith("platform/") || slug.startsWith("industries/")) {
        const visual = visualForSlug(slug);
        const sections = c.body.split(/(?=<h2>)/).filter(Boolean);
        const related = all
            .filter((p) => p.slug.startsWith("platform/") && p.id !== page.id)
            .slice(0, 3);
        return (
            <>
                <section className="hero feature-hero">
                    <div>
                        <p className="eyebrow">
                            {slug.startsWith("platform/")
                                ? "Connected logistics platform"
                                : "Built for your industry"}
                        </p>
                        <h1>{c.title}</h1>
                        <p className="lede">{c.description}</p>
                        <div className="hero-actions">
                            <Link className="cta" href="/book-demo">
                                Book a demo ↗
                            </Link>
                            <Link className="cta secondary" href="/platform">
                                Explore platform →
                            </Link>
                        </div>
                    </div>
                    {c.image ? (
                        <Image
                            className="product-shot"
                            src={c.image}
                            alt={c.image_alt ?? ""}
                            width={1200}
                            height={750}
                            unoptimized
                            style={{ height: "auto" }}
                        />
                    ) : visual ? (
                        <MarketingVisual name={visual} priority />
                    ) : (
                        <div className="feature-outline">
                            <p className="eyebrow">Inside this workflow</p>
                            {sections
                                .filter((s) => s.startsWith("<h2>"))
                                .map((section, i) => (
                                    <a href={`#workflow-${i}`} key={i}>
                                        <span className="outline-number">
                                            0{i + 1}
                                        </span>
                                        <strong>
                                            {section
                                                .match(/<h2>(.*?)<\/h2>/)?.[1]
                                                .replace(/<[^>]*>/g, "")}
                                        </strong>
                                        <span aria-hidden>↗</span>
                                    </a>
                                ))}
                            <p className="meta">
                                Explore the workflow with our team in a live
                                demo.
                            </p>
                        </div>
                    )}
                </section>
                <article className="feature-sections">
                    {sections.map((section, i) => (
                        <section
                            className="feature-section"
                            id={`workflow-${i}`}
                            key={i}
                        >
                            <span className="feature-number" aria-hidden>
                                0{i + 1}
                            </span>
                            <div
                                className="prose"
                                dangerouslySetInnerHTML={{ __html: section }}
                            />
                        </section>
                    ))}
                </article>
                {slug === "platform/integrations" && (
                    <section className="section-wrap">
                        <Link className="cta secondary" href="/docs">
                            Read the developer documentation ↗
                        </Link>
                    </section>
                )}
                <section className="section-wrap">
                    <p className="eyebrow">Keep exploring</p>
                    <h2>More of your operation, connected.</h2>
                    <div className="card-grid">
                        {related.map((p) => (
                            <Link
                                className="marketing-card"
                                href={`/${p.slug}`}
                                key={p.id}
                            >
                                <h3>{p.content.title}</h3>
                                <p>{p.content.description}</p>
                                <span className="arrow">
                                    Explore feature ↗
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
                <DemoCTA />
            </>
        );
    }
    return (
        <>
            <PageIntro
                eyebrow={
                    page.kind === "page" ? "Explore Spaces Digital" : page.kind
                }
                title={c.title}
                description={c.description}
            />
            <article className="prose">
                {c.author && (
                    <p className="meta">
                        By {c.author} ·{" "}
                        {new Date(page.published_at).toLocaleDateString(
                            "en-ZA",
                            {
                                timeZone: "Africa/Johannesburg",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                            },
                        )}
                    </p>
                )}
                {c.image && (
                    <Image
                        src={c.image}
                        alt={c.image_alt ?? ""}
                        width={1200}
                        height={750}
                        unoptimized
                        style={{ height: "auto" }}
                    />
                )}
                <div dangerouslySetInnerHTML={{ __html: c.body }} />
                {page.kind === "vacancy" && (
                    <div className="notice">
                        <p>
                            {c.location} · {c.employment_type}
                        </p>
                        <a
                            className="cta"
                            href={`mailto:${c.application_email}?subject=${encodeURIComponent(`Application: ${c.title}`)}`}
                        >
                            Apply by email ↗
                        </a>
                    </div>
                )}
                {slug === "security" && (
                    <Link href="/contact">
                        Contact us about security or privacy ↗
                    </Link>
                )}
                {slug === "platform/integrations" && (
                    <Link href="/docs">
                        Read the developer documentation ↗
                    </Link>
                )}
            </article>
            <DemoCTA />
        </>
    );
}
