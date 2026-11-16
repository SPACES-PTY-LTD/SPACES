import Link from "next/link";
import Image from "next/image";
import { features, industries, catalogueHref } from "@/lib/website/catalogue";
import type { PublishedContent } from "@/lib/website/types";
import { MarketingVisual } from "./visual";
import { DemoCTA } from "./shell";

export function Discovery({ section, contents }: { section: "platform" | "industries"; contents: PublishedContent[] | null }) {
    return <>
        <section className="discovery-hero section-wrap">
            <p className="eyebrow">{section === "platform" ? "The Spaces platform" : "Industries"}</p>
            <h1>{section === "platform" ? "Every run. A connected workflow." : "Built around the work you do."}</h1>
            <p>{section === "platform" ? "From route planning and dispatch to driver updates and delivery records. Explore the tools that keep your operation connected." : "Practical workflows for South African transport operators, distributors and delivery fleets."}</p>
            <div className="hero-actions"><Link className="cta" href="/book-demo">Book a demo ↗</Link><a href="#explore">Explore {section} ↓</a></div>
        </section>
        <div className="discovery-body" id="explore">
            {section === "platform" ? ["Planning", "Execution", "Oversight"].map((group, index) => <section className="section-wrap discovery-group" key={group}>
                <div className="discovery-heading"><p className="eyebrow">0{index + 1} / {group}</p><h2>{["Start with a clear plan.", "Keep the work moving.", "See what needs attention."][index]}</h2></div>
                <div className="discovery-grid">{features.filter(f => f.group === group).map(feature => <article className="discovery-card" id={feature.id} key={feature.id}>
                    <MarketingVisual name={feature.visual} />
                    <div className="discovery-copy"><h3>{feature.title}</h3><p>{feature.description}</p><p className="discovery-detail">{feature.detail}</p>
                    <Link href={catalogueHref("platform", feature.id, contents)}>Explore {feature.title.toLowerCase()} ↗</Link></div>
                </article>)}</div>
            </section>) : <section className="section-wrap discovery-grid industry-discovery">{industries.map(industry => <article className="discovery-card" id={industry.id} key={industry.id}>
                <figure><Image src={`/images/marketing/industry-${industry.id}.webp`} alt={`Illustrative ${industry.title.toLowerCase()} operation`} width={1536} height={1024} sizes="(max-width: 760px) 92vw, 45vw" /></figure>
                <div className="discovery-copy"><h2>{industry.title}</h2><p>{industry.description}</p><p className="discovery-detail">{industry.detail}</p><Link href={catalogueHref("industries", industry.id, contents)}>Explore this industry ↗</Link></div>
            </article>)}</section>}
        </div><DemoCTA />
    </>;
}
