import { protectedDocumentationPath } from "@/lib/documentation/access";
import { withBlogLibrary } from "@/lib/website/blog-posts";
import { features, industries } from "@/lib/website/catalogue";
import type { MetadataRoute } from "next";
import { publishedContent } from "@/lib/website/public";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    if (!base) return [];
    const fixed = [
        "",
        "platform",
        ...features.map(feature => `platform/${feature.id}`),
        "industries",
        ...industries.map(industry => `industries/${industry.id}`),
        "resources",
        "blog",
        "support",
        "faq",
        "company",
        "contact",
        "careers",
        "book-demo",
    ];
    const pages = await publishedContent();
    const entries: MetadataRoute.Sitemap = [
        ...fixed.map((slug) => ({ url: new URL(`/${slug}`, base).href })),
        ...withBlogLibrary(pages).filter(p => p.slug !== "pricing").map((p) => ({
            url: new URL(`/${p.slug}`, base).href,
            lastModified: p.published_at,
        })),
    ];
    return [...new Map(entries.filter(e => !protectedDocumentationPath(new URL(e.url).pathname)).map((e) => [e.url, e])).values()];
}
