import Link from "next/link";
import { redirect } from "next/navigation";
import { publishedContent } from "@/lib/website/public";
import { PageIntro } from "@/components/marketing/shell";
export const metadata = { title: "Support centre | Spaces Digital" };
export default async function Support({
    searchParams,
}: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
    const { q = "", category } = await searchParams;
    if (category?.toLowerCase() === "billing") redirect("/support");
    const all = await publishedContent();
    const articles = (all ?? []).filter(
        (p) =>
            p.kind === "help" &&
            (!category || p.content.category === category) &&
            `${p.content.title} ${p.content.body}`
                .toLowerCase()
                .includes(q.toLowerCase()),
    );
    return (
        <>
            <PageIntro
                title="How can we help?"
                description="Practical guidance for your whole team, from the first sign-in to everyday operations."
            />
            <section className="section-wrap">
                <form className="search-row" action="/support">
                    <input
                        name="q"
                        aria-label="Search help articles"
                        placeholder="Search guides and answers"
                        defaultValue={q}
                    />
                    <button type="submit">Search</button>
                </form>
                <div className="support-categories">
                    <Link href="/faq">Frequently asked questions</Link>
                    <Link href="/support">All guides</Link>
                    {[
                        "Getting started",
                        "Administrators",
                        "Dispatchers",
                        "Drivers",
                        "Integrations",
                    ].map((c) => (
                        <Link
                            href={`/support?category=${encodeURIComponent(c)}`}
                            key={c}
                        >
                            {c}
                        </Link>
                    ))}
                </div>
                <div className="card-grid">
                    {articles.map((p) => (
                        <Link
                            className="marketing-card"
                            href={`/${p.slug}`}
                            key={p.id}
                        >
                            <p className="eyebrow">{p.content.category}</p>
                            <h2>{p.content.title}</h2>
                            <p>{p.content.description}</p>
                        </Link>
                    ))}
                </div>
                {!articles.length && (
                    <p className="notice">
                        {all === null
                            ? "Help articles couldn’t load. Please try again shortly."
                            : "No matching articles. Try a different search or category."}
                    </p>
                )}
                <div className="notice">
                    <h2>Need help with your account?</h2>
                    <p>
                        Sign in to the web admin to create a private support
                        request and follow the conversation with our team.
                        Driver accounts cannot create tickets.
                    </p>
                    <Link className="cta" href="/admin/support">
                        Open support tickets ↗
                    </Link>
                    <p>
                        <Link href="/docs">
                            Looking for developer documentation?
                        </Link>
                    </p>
                </div>
            </section>
        </>
    );
}
