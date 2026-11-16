"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus, Search } from "lucide-react";
import { faqGroups } from "@/lib/website/faqs";
export function FaqBrowser() {
    const [query, setQuery] = useState("");
    const search = query.trim().toLowerCase();
    const groups = faqGroups.map(group => ({...group, items: group.items.filter(([question,answer]) => `${group.title} ${question} ${answer}`.toLowerCase().includes(search))})).filter(group => group.items.length);
    const count = groups.reduce((sum,group) => sum+group.items.length,0);
    return <>
        <header className="faq-hero"><div className="section-wrap"><p className="eyebrow">Frequently asked questions</p><h1>A clearer picture.<br />Before you get started.</h1><p>Find answers about Spaces, everyday workflows and the practical details of getting your team connected.</p><div className="faq-search"><Search size={22} aria-hidden="true" /><input type="search" aria-label="Search frequently asked questions" placeholder="Search your questions" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" onClick={()=>setQuery("")}>Clear</button>}</div></div></header>
        <div className="section-wrap faq-layout"><aside><p className="eyebrow">Browse by topic</p><nav aria-label="FAQ topics">{faqGroups.map(group => <a href={`#${group.id}`} key={group.id} onClick={()=>setQuery("")}>{group.title}</a>)}</nav><div className="faq-sidebar-help"><h2>Already using Spaces?</h2><p>Find guides or get help with your account.</p><Link href="/support">Visit the support centre <ArrowUpRight size={16} aria-hidden="true" /></Link></div></aside>
        <div className="faq-answers"><p className="faq-result-count" role="status">{search ? `${count} ${count===1?"answer":"answers"} found` : "Explore the topics below or search for a specific question."}</p>{groups.map(group => <section id={group.id} key={group.id}><h2>{group.title}</h2>{group.items.map(([question,answer,href,label]) => <details key={question}><summary>{question}<Plus size={22} aria-hidden="true" /></summary><div><p>{answer}</p><Link href={href}>{label} <ArrowUpRight size={16} aria-hidden="true" /></Link></div></details>)}</section>)}{!count && <div className="faq-no-results"><h2>No matching answers</h2><p>Try a shorter phrase, such as “tracking”, “documents” or “demo”.</p><button type="button" onClick={()=>setQuery("")}>Show all questions</button></div>}
        <div className="faq-contact"><p className="eyebrow">Still have a question?</p><h2>Let’s talk it through.</h2><p>Bring your workflow and questions to a demo, or contact the team for help finding the right next step.</p><div><Link className="cta" href="/book-demo">Book a demo <ArrowUpRight size={18} aria-hidden="true" /></Link><Link href="/contact">Contact us ↗</Link></div></div></div></div>
    </>;
}
