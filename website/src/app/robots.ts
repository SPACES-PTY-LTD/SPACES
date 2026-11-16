import type { MetadataRoute } from "next";
export default function robots(): MetadataRoute.Robots {
    const base = process.env.NEXT_PUBLIC_SITE_URL;
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/docs",
                "/platform/integrations",
                "/documentation-access",
                "/admin/",
                "/driver/",
                "/auth/",
                "/api/",
                "/book-demo/manage",
                "/dev-",
            ],
        },
        ...(base ? { sitemap: new URL("/sitemap.xml", base).href } : {}),
    };
}
