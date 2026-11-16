import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock3 } from "lucide-react";
import { blogAuthor, blogPosts, formatArticleDate, libraryPublishedAt, type BlogArticle } from "@/lib/website/blog-posts";
import type { PublishedContent } from "@/lib/website/types";
import { DemoCTA } from "./shell";

export function BlogCards({ posts }: { posts: PublishedContent[] }) {
    return <div className="blog-grid">{posts.map(post => <Link className="blog-card" href={`/${post.slug}`} key={post.slug}>
        {post.content.image && <div className="blog-card-image"><Image src={post.content.image} alt={post.content.image_alt ?? ""} width={768} height={512} unoptimized /></div>}
        <div className="blog-card-copy"><p className="eyebrow">{post.content.category ?? "Insights"}</p><h2>{post.content.title}</h2><p>{post.content.description}</p><div className="blog-card-meta"><span>{post.content.author ?? "Spaces Digital"}<br /><time dateTime={post.published_at}>Published {formatArticleDate(post.published_at)}</time></span><ArrowUpRight aria-hidden="true" size={22} /></div></div>
    </Link>)}</div>;
}
export function BlogIndex({ posts }: { posts: PublishedContent[] }) {
    return <><section className="blog-intro"><div><p className="eyebrow">The Spaces journal</p><h1>Practical ideas.<br />Clearer operations.</h1><p>Guides for the people planning runs, supporting drivers and keeping delivery records in order.</p><div className="blog-topics"><span>Planning & dispatch</span><span>Fleet visibility</span><span>Industry workflows</span></div></div></section><section className="section-wrap"><div className="blog-section-title"><h2>From the operations desk</h2><p>{posts.length} articles · Product guidance and practical checklists</p></div><BlogCards posts={posts} /></section><DemoCTA /></>;
}
export function BlogLanding({ article }: { article: BlogArticle }) {
    const words = article.sections.flatMap(section => [section.title, ...section.paragraphs, ...section.checklist]).join(" ").split(/\s+/).length;
    const related = blogPosts.filter(post => post.slug !== article.slug).sort((a,b) => Number(b.category === article.category)-Number(a.category === article.category)).slice(0,3);
    return <><header className="blog-intro blog-article-intro"><div><Link className="blog-back" href="/blog">← All articles</Link><p className="eyebrow">{article.category}</p><h1>{article.title}</h1><p>{article.description}</p><div className="blog-byline"><span>By {blogAuthor}</span><span><Clock3 size={16} aria-hidden="true" /> {Math.max(2, Math.ceil(words/180))} min read</span></div><div className="blog-dates"><span>Editorial date: <time dateTime={article.editorialDate}>{formatArticleDate(article.editorialDate)}</time></span><span>Published: <time dateTime={libraryPublishedAt}>{formatArticleDate(libraryPublishedAt)}</time></span></div></div></header>
    <figure className="blog-cover"><Image src={article.image} alt={`Illustrative logistics scene for ${article.title}`} width={1536} height={1024} priority unoptimized /></figure>
    <div className="blog-reading-layout"><aside className="blog-toc"><p className="eyebrow">In this article</p><nav aria-label="Article contents">{article.sections.map((section,index) => <a href={`#article-section-${index}`} key={section.title}>{section.title}</a>)}</nav><Link className="blog-product-link" href={`/platform/${article.feature}`}>Explore the related feature <ArrowUpRight size={18} aria-hidden="true" /></Link></aside><article className="blog-body">{article.sections.map((section,index) => <section id={`article-section-${index}`} key={section.title}><h2>{section.title}</h2>{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}{section.checklist.length > 0 && <ul>{section.checklist.map(item => <li key={item}>{item}</li>)}</ul>}</section>)}<div className="blog-author"><strong>{blogAuthor}</strong><p>Practical guidance on Spaces workflows and the daily work of transport and delivery teams.</p><small>Editorial dates identify the edition of each guide. The publication date records when it was added to this article library.</small></div></article></div>
    <section className="section-wrap blog-related"><div className="blog-section-title"><h2>Keep exploring</h2><Link href="/blog">View all articles ↗</Link></div><BlogCards posts={related.map((post,index) => ({id:index,slug:post.slug,kind:"blog",published_at:libraryPublishedAt,content:{...post,body:"",author:blogAuthor,image_alt:`Illustrative logistics scene for ${post.title}`}}))} /></section><DemoCTA /></>;
}
