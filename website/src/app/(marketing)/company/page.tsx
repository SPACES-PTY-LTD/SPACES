import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Route, FileCheck2, Users, MessagesSquare, BriefcaseBusiness, BookOpen } from "lucide-react";
import { DemoCTA } from "@/components/marketing/shell";

export const metadata: Metadata = {
    title: "Company | Spaces Digital",
    description: "Meet Spaces Digital: connected logistics workflows for the people planning runs, supporting drivers and keeping deliveries moving.",
    alternates: { canonical: "/company" },
    openGraph: { title: "Keep the people behind every delivery connected.", description: "Discover the purpose behind Spaces Digital and explore our work, careers and practical resources.", images: ["/images/marketing/blog-dispatch.webp"] },
};
const principles = [
    { icon: Users, title: "Start with the people doing the work.", text: "Dispatchers, drivers and administrators see different parts of the same delivery. Our focus is on the handovers that connect them." },
    { icon: Route, title: "Keep the workflow connected.", text: "Planning is only one part of the day. Runs, available vehicle tracking and delivery records need to make sense together." },
    { icon: FileCheck2, title: "Make the details easier to follow.", text: "A useful operational record links the shipment, its documents and the work that still needs attention. Clear records support useful follow-up." },
];
export default function Company() {
    return <article className="company-page">
        <section className="company-hero"><div className="section-wrap"><p className="eyebrow">About Spaces Digital</p><h1>Behind every delivery,<br />people make it happen.</h1><p className="company-lede">We build logistics software that connects the people planning the day with the people carrying it out.</p><div className="hero-actions"><Link className="cta" href="/contact">Get to know Spaces <ArrowUpRight size={18} aria-hidden="true" /></Link><a href="#our-purpose">Our purpose ↓</a></div><div className="company-photo-grid"><figure><Image src="/images/marketing/blog-dispatch.webp" alt="Illustration of dispatch colleagues planning work together" width={1536} height={1024} priority /></figure><figure><Image src="/images/marketing/blog-driver.webp" alt="Illustration of a driver reviewing delivery paperwork beside a parked vehicle" width={1536} height={1024} priority /></figure></div></div></section>
        <section className="section-wrap company-purpose" id="our-purpose"><div><p className="eyebrow">Our purpose</p><h2>A clearer working day.<br />A connected operation.</h2></div><div><p>Transport and delivery teams coordinate more than vehicles. They manage changing schedules, driver assignments, customer locations and the paperwork that follows each shipment.</p><p>Spaces brings these workflows into one workspace, from planning and dispatch to driver delivery-note uploads and operational reporting. The aim is simple: help each team understand the work, find its records and see what needs attention.</p><Link className="home-text-link" href="/platform">Explore what we build <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
        <section className="company-principles"><div className="section-wrap"><p className="eyebrow">What guides the product</p><h2>Useful software starts<br />with real work.</h2><div className="company-principle-grid">{principles.map(({icon: Icon,title,text}) => <div key={title}><Icon size={30} strokeWidth={1.5} aria-hidden="true" /><h3>{title}</h3><p>{text}</p></div>)}</div></div></section>
        <section className="section-wrap company-focus"><figure><Image src="/images/marketing/industry-wholesale-distribution.webp" alt="Illustrative wholesale distribution and delivery operation" width={1536} height={1024} /></figure><div><p className="eyebrow">Who we build for</p><h2>Grounded in transport.<br />Connected to your day.</h2><p>Spaces focuses on the workflows of South African transport operators, distributors and delivery fleets: road freight, wholesale distribution, courier operations, retail delivery and fuel-depot transport coordination.</p><p>Every operation has its own requirements. A walkthrough is a chance to discuss your runs, documents and tracking connections, and identify where Spaces fits.</p><Link className="home-text-link" href="/industries">Find your industry <ArrowUpRight size={18} aria-hidden="true" /></Link></div></section>
        <section className="section-wrap company-next"><p className="eyebrow">Stay connected</p><h2>There’s more to explore.</h2><div className="company-next-grid">{[
            {icon: BriefcaseBusiness,title:"Work with purpose",text:"Explore our work and see published opportunities when roles are available.",href:"/careers",label:"Explore careers"},
            {icon: BookOpen,title:"Ideas from operations",text:"Read practical guides to dispatch, delivery documents and fleet visibility.",href:"/blog",label:"Read the journal"},
            {icon: MessagesSquare,title:"Start a conversation",text:"Discuss your operation, arrange a walkthrough or find help for your account.",href:"/contact",label:"Contact the team"},
        ].map(({icon: Icon,title,text,href,label}) => <Link href={href} key={href}><Icon size={26} strokeWidth={1.5} aria-hidden="true" /><h3>{title}</h3><p>{text}</p><span>{label} <ArrowUpRight size={18} aria-hidden="true" /></span></Link>)}</div></section>
        <DemoCTA />
    </article>;
}
