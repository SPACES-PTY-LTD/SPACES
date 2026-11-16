import Link from "next/link";
import { publicData, publishedContent } from "@/lib/website/public";
import { PageIntro } from "@/components/marketing/shell";
export const metadata = { title: "Contact | Spaces Digital" };
export default async function Contact() {
    const securityPublished = (await publishedContent())?.some(
        (p) => p.slug === "security",
    );
    const contacts = await publicData<Record<string, string>>("contact");
    return (
        <>
            <PageIntro
                title="Let’s talk about your operation."
                description="Explore the platform with our team, or find the right route for an existing account."
            />
            <section className="section-wrap">
                {contacts?.company_name && <p>{contacts.company_name}</p>}
                <div className="card-grid">
                    <article className="marketing-card">
                        <h2>Sales & demos</h2>
                        <p>
                            Bring your current workflow and integration
                            questions.
                        </p>
                        <Link className="cta" href="/book-demo">
                            Book a demo ↗
                        </Link>
                        {contacts?.sales_email && (
                            <p>
                                <a href={`mailto:${contacts.sales_email}`}>
                                    {contacts.sales_email}
                                </a>
                            </p>
                        )}
                    </article>
                    <article className="marketing-card">
                        <h2>Customer support</h2>
                        <p>
                            Find guidance or sign in to manage a private support
                            request.
                        </p>
                        <Link href="/support">Visit the support centre ↗</Link>
                        {contacts?.support_email && (
                            <p>
                                <a href={`mailto:${contacts.support_email}`}>
                                    {contacts.support_email}
                                </a>
                            </p>
                        )}
                    </article>
                    <article className="marketing-card">
                        <h2>Security & privacy</h2>
                        <p>
                            Review our security information and discuss your
                            requirements during a demo.
                        </p>
                        {securityPublished && (
                            <Link href="/security">Read about security ↗</Link>
                        )}
                        {["security_email", "privacy_email"].map(
                            (k) =>
                                contacts?.[k] && (
                                    <p key={k}>
                                        <a href={`mailto:${contacts[k]}`}>
                                            {contacts[k]}
                                        </a>
                                    </p>
                                ),
                        )}
                    </article>
                </div>
            </section>
        </>
    );
}
