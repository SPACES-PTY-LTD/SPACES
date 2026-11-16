import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ArrowUpRight, Check, Layers3, ListChecks, Workflow } from "lucide-react";
import { features } from "@/lib/website/catalogue";
import { featurePages, type FeaturePage } from "@/lib/website/feature-pages";
import type { PublishedContent } from "@/lib/website/types";
import { MarketingVisual } from "./visual";
import { DemoCTA } from "./shell";

export function FeatureLanding({ feature, editorial }: { feature: (typeof features)[number]; editorial?: PublishedContent }) {
    return <SolutionLanding feature={feature} page={featurePages[feature.id]} editorial={editorial} />;
}
export function SolutionLanding({ feature, page, editorial, industryPhoto }: { feature: { id: string; title: string; visual: string }; page: FeaturePage; editorial?: PublishedContent; industryPhoto?: string }) {
    const icons = [Layers3, Workflow, ListChecks];
    return <article className="platform-landing">
        <section className={`platform-hero ${industryPhoto ? "industry-landing-hero" : ""}`}>
            <div className="platform-hero-inner">
                <nav className="feature-breadcrumb" aria-label="Breadcrumb"><Link href={industryPhoto ? "/industries" : "/platform"}>{industryPhoto ? "Industries" : "Platform"}</Link><span aria-hidden="true">/</span><span>{feature.title}</span></nav>
                <div className="solution-hero-copy"><p className="eyebrow">{feature.title}</p>
                <h1>{page.headline}</h1><p className="platform-lede">{page.intro}</p>
                <div className="hero-actions"><Link className="cta" href="/book-demo">Book a demo <ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#workflow">Explore the workflow <ArrowRight size={18} aria-hidden="true" /></a></div>
                </div>
                {industryPhoto ? <figure className="industry-landing-photo"><Image src={industryPhoto} alt={`Illustrative ${feature.title.toLowerCase()} operation`} width={1536} height={1024} sizes="(max-width: 700px) 90vw, 50vw" priority /></figure> : <MarketingVisual name={`hero-${feature.id}`} priority />}
            </div>
        </section>
        <nav className="feature-jump-links" aria-label="On this page"><a href="#why">Why it matters</a><a href="#capabilities">Capabilities</a><a href="#workflow">How it works</a><a href="#feature-faqs">FAQs</a></nav>
        <section className="section-wrap feature-value" id="why">
            <div className="feature-section-heading"><p className="eyebrow">A clearer way to work</p><h2>{page.problem}</h2><p>{page.context}</p></div>
            <div className="feature-benefits">{page.benefits.map(([title, body], index) => { const Icon = icons[index]; return <div key={title}><Icon size={26} strokeWidth={1.5} aria-hidden="true" /><h3>{title}</h3><p>{body}</p></div>; })}</div>
        </section>
        <div id="capabilities">{page.chapters.map((chapter, index) => <section className={`platform-chapter ${index % 2 ? "is-light" : "is-dark"}`} key={chapter.title}>
            <div className={`section-wrap platform-chapter-inner ${index % 2 ? "is-reversed" : ""}`}>
                <div><p className="eyebrow">{feature.title} / 0{index + 1}</p><h2>{chapter.title}</h2><p>{chapter.body}</p><ul>{chapter.points.map(point => <li key={point}><Check size={18} aria-hidden="true" />{point}</li>)}</ul>{feature.id === "integrations" && index === 1 && <Link className="feature-inline-link" href="/docs">Read developer documentation <ArrowUpRight size={17} aria-hidden="true" /></Link>}</div>
                <MarketingVisual name={chapter.visual} />
            </div>
        </section>)}</div>
        <section className="section-wrap feature-workflow" id="workflow"><div className="feature-section-heading"><p className="eyebrow">From first step to follow-up</p><h2>How the workflow connects.</h2><p>Explore these steps with your own operating process in a guided demo.</p></div><ol>{page.steps.map(([title, body], index) => <li key={title}><span className="workflow-step-number">0{index + 1}</span><h3>{title}</h3><p>{body}</p></li>)}</ol></section>
        {editorial?.content.body && <section className="section-wrap feature-editorial"><p className="eyebrow">Published product details</p><div className="prose" dangerouslySetInnerHTML={{ __html: editorial.content.body }} /></section>}
        <section className="feature-faq-band" id="feature-faqs"><div className="section-wrap feature-faq-grid"><div><p className="eyebrow">Useful answers</p><h2>Before you get started.</h2><p>Have a question about your operation?</p><Link href="/book-demo">Talk it through in a demo <ArrowUpRight size={17} aria-hidden="true" /></Link></div><div>{page.faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
        <section className="section-wrap feature-related"><p className="eyebrow">Keep your operation connected</p><h2>Explore more features</h2><div>{page.related.map(id => { const related = features.find(f => f.id === id)!; return <Link href={`/platform/${id}`} key={id}><MarketingVisual name={related.id === "driver-app" ? "driver" : related.visual} /><div className="related-copy"><h3>{related.title}</h3><p>{related.description}</p><span>Explore feature <ArrowUpRight size={17} aria-hidden="true" /></span></div></Link>; })}</div></section>
        <DemoCTA />
    </article>;
}
