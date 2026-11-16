import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function harness(desktop = true) {
  const slots=[],timers=new Map(); let cursor=0,tree,focus=null;
  const root={contains:()=>false,querySelector:()=>({focus(){focus='trigger';}})};
  const react={useState(initial){const i=cursor++;slots[i]??={value:initial};return [slots[i].value,v=>slots[i].value=v];},useRef(initial){const i=cursor++;slots[i]??={current:i===2?root:initial};return slots[i];},useEffect(){cursor++;}};
  const jsx=(type,props)=>({type,props});const exports={};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/marketing/mobile-menu.tsx',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:name=> name==='react'?react:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='next/link'?{default:'a'}:name==='next/navigation'?{usePathname:()=>'/'}:{},window:{matchMedia:()=>({matches:desktop})},document:{activeElement:null},setTimeout(fn){timers.set(1,fn);return 1;},clearTimeout(id){timers.delete(id);},requestAnimationFrame:fn=>fn()});
  const items=[{label:'Platform',href:'/platform',children:[{label:'Schedule',href:'/platform#scheduling',group:'Planning'},{label:'Tracking',href:'/platform#tracking',group:'Execution'}]},{label:'Pricing',href:'/pricing'}];
  function render(){cursor=0;tree=exports.MarketingNavigation({items});}
  function nodes(n){return Array.isArray(n)?n.flatMap(nodes):n&&typeof n==='object'?[n,...nodes(n.props?.children)]:[];}
  const find=predicate=>{const n=nodes(tree).find(predicate);assert.ok(n);return n;};
  render();return {render,find,timers,get focus(){return focus;}};
}
test('desktop pointer opens a grouped white-menu structure; click does not undo hover',()=>{
 const app=harness();app.find(n=>n.props?.className==='nav-item').props.onPointerEnter({pointerType:'mouse'});app.render();
 assert.equal(app.find(n=>n.props?.['data-nav']==='Platform').props['aria-expanded'],true);
 app.find(n=>n.props?.['data-nav']==='Platform').props.onClick({detail:1});app.render();assert.equal(app.find(n=>n.props?.id==='nav-Platform').props.hidden,false);
 assert.ok(app.find(n=>n.type==='section'&&n.props['aria-label']==='Planning'));
 app.find(n=>n.props?.className==='navigation').props.onPointerLeave({pointerType:'mouse'});app.timers.get(1)();app.render();assert.equal(app.find(n=>n.props?.id==='nav-Platform').props.hidden,true);
});
test('touch ignores hover and click toggles; Escape returns focus and closes dropdown',()=>{
 const app=harness(false);const trigger=()=>app.find(n=>n.props?.['data-nav']==='Platform');
 app.find(n=>n.props?.className==='nav-item').props.onPointerEnter({pointerType:'touch'});app.render();assert.equal(trigger().props['aria-expanded'],false);
 trigger().props.onClick({detail:1});app.render();assert.equal(trigger().props['aria-expanded'],true);
 app.find(n=>n.props?.className==='navigation').props.onKeyDown({key:'Escape'});app.render();assert.equal(trigger().props['aria-expanded'],false);assert.equal(app.focus,'trigger');
});
test('ArrowDown opens menu and focuses a destination; navigation closes on link selection',()=>{
 const app=harness();app.find(n=>n.props?.['data-nav']==='Platform').props.onKeyDown({key:'ArrowDown',preventDefault(){}});app.render();assert.equal(app.focus,'trigger');
 app.find(n=>n.props?.href==='/platform#scheduling').props.onClick();app.render();assert.equal(app.find(n=>n.props?.id==='nav-Platform').props.hidden,true);
});
