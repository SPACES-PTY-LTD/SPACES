import Link from "next/link";
import { publishedContent } from "@/lib/website/public";
import { PageIntro } from "@/components/marketing/shell";
export const metadata = { title: "Careers | Spaces Digital" };
export default async function Careers() {
    const all = await publishedContent();
    const jobs = (all ?? []).filter((p) => p.kind === "vacancy");
    return (
        <>
            <PageIntro
                eyebrow="Careers"
                title="Help make logistics work better."
                description="We build tools for the people coordinating vehicles, drivers, shipments and delivery documents."
            />
            <section className="prose">
                <h2>Work with a clear purpose</h2>
                <p>
                    Our product focuses on the operational details that connect
                    planning with what happens in the field. Explore the
                    platform to understand the problems we work on.
                </p>
                <Link href="/platform">Explore our work ↗</Link>
                <h2>Open positions</h2>
                {jobs.map((p) => (
                    <Link
                        className="marketing-card"
                        href={`/${p.slug}`}
                        key={p.id}
                    >
                        <h3>{p.content.title}</h3>
                        <p>
                            {p.content.location} · {p.content.employment_type}
                        </p>
                        <span>View role ↗</span>
                    </Link>
                ))}
                {!jobs.length && (
                    <p className="notice">
                        {all === null
                            ? "We couldn’t load vacancies. Please check again shortly."
                            : "No open positions at the moment. We will publish genuine opportunities here as they become available."}
                    </p>
                )}
            </section>
        </>
    );
}
