import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/website/blog-posts.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Intl,Date,Map});
const {blogPosts,blogContent,withBlogLibrary,libraryPublishedAt}=exports;
test('ten complete guides have unique routes, distinct real assets and valid related feature destinations',()=>{
 assert.equal(blogPosts.length,10);assert.equal(new Set(blogPosts.map(p=>p.slug)).size,10);assert.equal(new Set(blogPosts.map(p=>p.image)).size,10);
 for(const p of blogPosts){assert.equal(p.sections.length,4);assert.ok(p.sections.flatMap(s=>s.paragraphs).join(' ').split(/\s+/).length>240);assert.ok(existsSync(new URL('../public'+p.image,import.meta.url)));assert.ok(['scheduling','tracking','driver-app','documents','automation','reporting','integrations'].includes(p.feature));}
});
test('earlier editorial editions never become false historical publication timestamps',()=>{
 assert.ok(blogPosts.some(p=>Date.parse(p.editorialDate)<Date.parse(libraryPublishedAt)));
 for(const p of blogContent())assert.equal(p.published_at,libraryPublishedAt);
});
test('library survives public service failure and published CMS overrides deduplicate by slug',()=>{
 assert.equal(withBlogLibrary(null).length,10);
 const published={...blogContent()[0],id:12,content:{title:'Published revision',description:'Approved',body:'<p>Approved</p>'}};
 const merged=withBlogLibrary([published]);assert.equal(merged.length,10);assert.equal(merged.find(p=>p.slug===published.slug).content.title,'Published revision');
 assert.equal(exports.blogArticle('blog/nonexistent'),undefined);
});
