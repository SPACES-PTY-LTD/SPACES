import "server-only";
import type { PublishedContent } from "./types";
export async function publicData<T>(path: string): Promise<T | null> {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!base) return null;
    try {
        const response = await fetch(new URL(`/api/v1/website/${path}`, base), {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return null;
        return (await response.json()).data as T;
    } catch {
        return null;
    }
}
export async function publishedContent() {
    const pages = await publicData<PublishedContent[]>("content");
    // Product updates are withdrawn from the public website; retain CMS records.
    return pages?.filter(page => page.kind !== "update" && page.slug !== "updates" && !page.slug.startsWith("updates/")) ?? null;
}
