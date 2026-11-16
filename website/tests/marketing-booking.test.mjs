import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function compile(path, modules = {}, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require: name => modules[name], Date, Intl, Error, URLSearchParams, ...globals });
  return exports;
}
const catalogue = compile('../src/lib/website/catalogue.ts');
test('built-in platform and industry destinations stay available without CMS content', () => {
  for (const feature of catalogue.features) {
    assert.equal(catalogue.catalogueHref('platform', feature.id, null), `/platform/${feature.id}`);
    assert.equal(catalogue.catalogueHref('platform', feature.id, []), `/platform/${feature.id}`);
    assert.equal(catalogue.catalogueHref('platform', feature.id, [{slug:`platform/${feature.id}`}]), `/platform/${feature.id}`);
  }
  for (const industry of catalogue.industries) assert.equal(catalogue.catalogueHref('industries', industry.id, []), `/industries/${industry.id}`);
});
class RequestError extends Error { constructor(message, status, fields = {}) { super(message); this.status = status; this.fields = fields; } }
function harness(manage = false) {
  const state = [], effects = [], requests = [];
  let cursor = 0, tree;
  const react = {
    useState(initial) { const i = cursor++; state[i] ??= { value: initial }; return [state[i].value, next => state[i].value = typeof next === 'function' ? next(state[i].value) : next]; },
    useRef(initial) { const i = cursor++; state[i] ??= { current: initial }; return state[i]; },
    useEffect(effect, deps) { const i = cursor++; const old = state[i]; if (!old || deps.some((d,j) => !Object.is(d, old.deps[j]))) { old?.cleanup?.(); state[i] = {deps}; effects.push(() => state[i].cleanup = effect()); } },
  };
  const jsx = (type, props) => ({type, props});
  const {DemoForm} = compile('../src/components/marketing/demo-form.tsx', {react, 'next/link':{default:'a'}, './demo-date-picker':{DemoDatePicker:'DemoDatePicker'}, 'lucide-react':{CalendarDays:'CalendarDays',Check:'Check',CheckCircle2:'CheckCircle2',Clock3:'Clock3'}, 'react/jsx-runtime':{jsx,jsxs:jsx}, '@/lib/website/request': {WebsiteRequestError:RequestError, websiteRequest: (...args) => new Promise((resolve,reject) => requests.push({args,resolve,reject}))}}, {window:{location:{hash:manage?'#token='+ 'a'.repeat(64):'',pathname:'/book-demo/manage'},history:{replaceState(){}}}});
  function render() { cursor = 0; tree = DemoForm({manage}); while(effects.length) effects.shift()(); }
  function nodes(node=tree) { return Array.isArray(node) ? node.flatMap(n=>nodes(n ?? null)) : node && typeof node === 'object' ? [node,...nodes(node.props?.children ?? null)] : []; }
  const text = node => Array.isArray(node) ? node.map(text).join('') : node && typeof node === 'object' ? text(node.props?.children) : String(node ?? '');
  const find = predicate => { const node=nodes().find(predicate); assert.ok(node, 'Expected control exists'); return node; };
  const button = label => find(n=>n.type==='button' && text(n)===label);
  const change = (id,value) => { find(n=>n.props?.id===id).props.onChange(id==='demo-date'?value:{target:{value}}); render(); };
  const submit = () => { find(n=>n.type==='form').props.onSubmit({preventDefault(){}}); render(); };
  const tick = async () => { for(let i=0;i<8;i++) await Promise.resolve(); render(); };
  render();
  return {render,requests,nodes,text,find,button,change,submit,tick};
}
const at = '2026-11-04T08:00:00Z';
async function choose(app) { app.change('demo-date','2026-11-04'); app.requests.at(-1).resolve([at]); await app.tick(); app.button('10:00').props.onClick(); app.render(); app.submit(); }
test('time-first flow preserves details, prevents duplicate posts and shows server-confirmed time', async()=>{
  const app=harness(); assert.equal(app.button('Continue →').props.disabled,true);
  await choose(app); app.change('demo-name','Demo Tester'); app.change('demo-email','demo@example.test');
  app.button('Change time').props.onClick(); app.render(); app.submit();
  assert.equal(app.find(n=>n.props?.id==='demo-name').props.value,'Demo Tester');
  app.submit(); app.submit(); assert.equal(app.requests.filter(r=>r.args[2]==='POST').length,1);
  assert.equal(app.requests.at(-1).args[3].email,'demo@example.test');
  app.requests.at(-1).resolve({starts_at:'2026-11-04T09:00:00Z',status:'confirmed'}); await app.tick();
  assert.match(app.text(app.nodes()[0]),/11:00/); assert.match(app.text(app.nodes()[0]),/You’re booked in/);
});
test('slot conflict refreshes times and preserves details while validation stays inline',async()=>{
  const app=harness(); await choose(app); app.change('demo-name','Saved Name'); app.submit();
  app.requests.at(-1).reject(new RequestError('Validation',422,{name:['Name invalid']})); await app.tick();
  assert.equal(app.find(n=>n.props?.id==='demo-name').props['aria-invalid'],true);
  app.submit(); app.requests.at(-1).reject(new RequestError('Unavailable',422,{starts_at:['Unavailable']})); await app.tick();
  assert.match(app.text(app.nodes()[0]),/your details have been saved/);
  app.requests.at(-1).resolve([at]); await app.tick(); app.button('10:00').props.onClick();app.render();app.submit();
  assert.equal(app.find(n=>n.props?.id==='demo-name').props.value,'Saved Name');
});
test('stale availability cannot replace a newer day; empty and failed responses differ', async()=>{
  const app=harness(); app.change('demo-date','2026-11-04'); const older=app.requests.at(-1);
  app.change('demo-date','2026-11-05'); app.requests.at(-1).resolve([]);await app.tick();older.resolve([at]);await app.tick();
  assert.match(app.text(app.nodes()[0]),/No appointments are available/);assert.equal(app.nodes().some(n=>n.type==='button'&&app.text(n)==='10:00'),false);
  app.change('demo-date','2026-11-06'); app.requests.at(-1).reject(new Error('offline'));await app.tick();
  assert.match(app.text(app.nodes()[0]),/couldn’t check availability/);assert.ok(app.button('Retry availability'));
});
test('expired management link reports failure without a misleading slot refresh',async()=>{
  const app=harness(true);app.render();await choose(app);app.submit();app.requests.at(-1).reject(new RequestError('This appointment cannot be changed.',409));await app.tick();
  assert.match(app.text(app.nodes()[0]),/This appointment cannot be changed/);assert.ok(app.button('Confirm new time'));
});
test('cancellation requires an explicit confirmation and retains the private management token',async()=>{
  const app=harness(true);app.render();app.button('Cancel appointment').props.onClick();app.render();
  assert.equal(app.requests.length,0);app.button('Yes, cancel appointment').props.onClick();app.render();
  assert.equal(app.requests[0].args[3].action,'cancel');assert.equal(app.requests[0].args[3].token,'a'.repeat(64));
  app.requests[0].resolve({status:'cancelled',starts_at:at});await app.tick();assert.match(app.text(app.nodes()[0]),/Appointment cancelled/);
});
const landingContent = compile('../src/lib/website/feature-pages.ts', {'./catalogue':catalogue});
test('all seven built-in features have complete distinct landing content and valid related destinations',()=>{
 assert.equal(catalogue.features.length,7);
 const headlines=new Set();
 for(const feature of catalogue.features){
   const page=landingContent.featurePages[feature.id];assert.ok(page);headlines.add(page.headline);
   assert.equal(landingContent.platformFeature(`platform/${feature.id}`).id,feature.id);
   assert.equal(page.benefits.length,3);assert.equal(page.steps.length,3);assert.ok(page.chapters.length>=2);assert.ok(page.faqs.length>=3);
   for(const id of page.related) assert.ok(catalogue.features.some(f=>f.id===id && id!==feature.id));
 }
 assert.equal(headlines.size,7);assert.equal(landingContent.platformFeature('platform/unknown'),undefined);
});
const industryContent = compile('../src/lib/website/industry-pages.ts', {'./catalogue':catalogue});
test('all five industries including fuel depots have distinct complete landing pages and real assets',()=>{
 assert.equal(catalogue.industries.length,5);assert.ok(catalogue.industries.some(i=>i.id==='fuel-depots'));
 const titles=new Set();
 for(const industry of catalogue.industries){
   const page=industryContent.industryPages[industry.id];assert.ok(page);titles.add(page.headline);
   assert.equal(industryContent.industryForSlug(`industries/${industry.id}`).id,industry.id);
   assert.equal(page.benefits.length,3);assert.equal(page.steps.length,3);assert.equal(page.chapters.length,3);assert.ok(page.faqs.length>=3);
   for(const id of page.related) assert.ok(catalogue.features.some(f=>f.id===id));
   assert.ok(readFileSync(new URL(`../public/images/marketing/industry-${industry.id}.webp`,import.meta.url)).length>1000);
 }
 assert.equal(titles.size,5);assert.equal(industryContent.industryForSlug('industries/unknown'),undefined);
 assert.match(industryContent.industryPages['fuel-depots'].faqs.map(f=>f[1]).join(' '),/does not promise tank telemetry/);
});
